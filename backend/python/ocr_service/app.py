"""
Internal OCR service for Studio Tools, built on PaddleOCR 3.x.

- Reads English, Nepali and mixed text (the Devanagari model reads Latin too).
- Returns every line with its words, boxes and confidence, plus PP-DocLayout's layout regions
  (title, text, table, header, footer…). Turning that into a document happens in the Node API.
- Loads each model once, on first use, and keeps it. One recognition at a time (Paddle's predictors
  aren't thread-safe).
- Binds to localhost and requires a shared token, so only the Node API can use it.
- Never returns stack traces, paths or model internals to the caller, and never logs the text it reads.
"""

from __future__ import annotations

import hmac
import logging
import os
import threading
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Form, Header, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse

TOKEN = os.environ.get("INTERNAL_SERVICE_TOKEN", "")
MAX_BYTES = int(float(os.environ.get("MAX_IMAGE_SIZE_MB", "10")) * 1024 * 1024)
MAX_PIXELS = int(os.environ.get("MAX_IMAGE_PIXELS", str(40_000_000)))
# Mobile detection: on CPU it is ~10–30× faster than the server detector and reads documents well.
DETECTION_MODEL = os.environ.get("OCR_DETECTION_MODEL", "PP-OCRv5_mobile_det")
RECOGNITION_MODELS = {
    # Devanagari: Nepali (and Hindi, Marathi…) — and it reads Latin, so it also serves mixed text.
    "devanagari": os.environ.get("OCR_DEVANAGARI_MODEL", "devanagari_PP-OCRv5_mobile_rec"),
    # PP-OCRv6: ~0.6s slower than the English mobile model, but it keeps bullets (•) the other drops.
    "en": os.environ.get("OCR_ENGLISH_MODEL", "PP-OCRv6_medium_rec"),
}
LAYOUT_MODEL = os.environ.get("OCR_LAYOUT_MODEL", "PP-DocLayout_plus-L")
# Whole-page orientation (0/90/180/270) — scans and PDF pages carry no EXIF to say which way is up.
ORIENTATION_MODEL = os.environ.get("OCR_ORIENTATION_MODEL", "PP-LCNet_x1_0_doc_ori")
# Below this, the page is left as it is: a wrong turn would be worse than none.
ORIENTATION_MIN_SCORE = 0.6
# Below this share of Devanagari letters, "auto" treats the page as English and reads it again with the
# English model (which is more accurate on Latin text).
DEVANAGARI_MIN_SHARE = 0.05

logging.basicConfig(level=logging.INFO, format="[ocr] %(levelname)s %(message)s")
log = logging.getLogger("ocr_service")
for noisy in ("paddlex", "paddle", "ppocr"):
    logging.getLogger(noisy).setLevel(logging.ERROR)

state: dict[str, object] = {"ready": False, "error": None}
models: dict[str, object] = {}
models_lock = threading.Lock()
work_lock = threading.Lock()


def error(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"success": False, "code": code, "message": message})


def watch_parent() -> None:
    """Exit if the Node process that launched us goes away, so no orphaned model process is left."""
    parent = int(os.environ.get("PARENT_PID", "0") or 0)
    if parent <= 0:
        return

    def loop() -> None:
        while True:
            time.sleep(2)
            if os.getppid() != parent:
                log.info("parent process exited; shutting down")
                os._exit(0)

    threading.Thread(target=loop, daemon=True, name="parent-watchdog").start()


def model(key: str):
    """A loaded model, created once. Keys: "devanagari", "en" (recognition pipelines), "layout"."""
    with models_lock:
        if key not in models:
            started = time.perf_counter()
            if key == "layout":
                from paddleocr import LayoutDetection

                models[key] = LayoutDetection(model_name=LAYOUT_MODEL)
            elif key == "orientation":
                from paddleocr import DocImgOrientationClassification

                models[key] = DocImgOrientationClassification(model_name=ORIENTATION_MODEL)
            else:
                from paddleocr import PaddleOCR

                models[key] = PaddleOCR(
                    text_detection_model_name=DETECTION_MODEL,
                    text_recognition_model_name=RECOGNITION_MODELS[key],
                    # The Node side already turns the image upright; these would only cost time.
                    use_doc_orientation_classify=False,
                    use_doc_unwarping=False,
                    use_textline_orientation=False,
                )
            log.info("model '%s' loaded in %.1fs", key, time.perf_counter() - started)
        return models[key]


@asynccontextmanager
async def lifespan(_: FastAPI):
    watch_parent()
    try:
        # Importing Paddle proves the environment works; models load on first use.
        await run_in_threadpool(lambda: __import__("paddleocr"))
        state["ready"] = True
    except Exception:  # noqa: BLE001 — logged server-side, reported generically
        state["error"] = "import-failed"
        log.exception("PaddleOCR could not be imported")
    yield


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


def authorised(token: str | None) -> bool:
    return bool(TOKEN) and token is not None and hmac.compare_digest(token, TOKEN)


@app.get("/health")
async def health(x_internal_token: str | None = Header(default=None)):
    if not authorised(x_internal_token):
        return error(401, "UNAUTHORIZED", "Unauthorized.")
    return {"ready": state["ready"], "error": state["error"], "loaded": sorted(models)}


def script_counts(texts: list[str]) -> tuple[int, int]:
    devanagari = latin = 0
    for text in texts:
        for char in text:
            if "ऀ" <= char <= "ॿ":
                devanagari += 1
            elif char.isascii() and char.isalpha():
                latin += 1
    return devanagari, latin


def read(key: str, image) -> list[dict]:
    """Lines with their words. Word boxes come from the recogniser's character positions."""
    result = model(key).predict(image, return_word_box=True)[0]
    lines = []
    texts = result["rec_texts"]
    for index, text in enumerate(texts):
        if not text.strip():
            continue
        x1, y1, x2, y2 = (float(value) for value in result["rec_boxes"][index])
        polygon = [[float(x), float(y)] for x, y in result["rec_polys"][index]]
        words = []
        for word, box in zip(result["text_word"][index], result["text_word_boxes"][index]):
            if word.strip():
                wx1, wy1, wx2, wy2 = (float(value) for value in box)
                words.append({"text": word, "box": [wx1, wy1, wx2 - wx1, wy2 - wy1]})
        lines.append({"text": text, "confidence": float(result["rec_scores"][index]), "box": [x1, y1, x2 - x1, y2 - y1], "polygon": polygon, "words": words})
    return lines


def layout(image) -> list[dict]:
    result = model("layout").predict(image)[0]
    return [
        {"label": box["label"], "score": float(box["score"]), "box": [float(box["coordinate"][0]), float(box["coordinate"][1]), float(box["coordinate"][2] - box["coordinate"][0]), float(box["coordinate"][3] - box["coordinate"][1])]}
        for box in result["boxes"]
    ]


def recognise(data: bytes, language: str, with_layout: bool) -> dict:
    import cv2
    import numpy as np

    image = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR | cv2.IMREAD_IGNORE_ORIENTATION)
    if image is None:
        raise ValueError("decode")
    height, width = image.shape[:2]
    if width * height > MAX_PIXELS:
        raise ValueError("size")

    timings: dict[str, float] = {}
    started = time.perf_counter()
    if language == "en":
        lines, detected = read("en", image), "en"
    else:
        lines = read("devanagari", image)
        devanagari, latin = script_counts([line["text"] for line in lines])
        letters = devanagari + latin
        if language == "auto" and letters and devanagari / letters < DEVANAGARI_MIN_SHARE:
            # No Nepali on the page: the English model reads Latin text more accurately.
            lines, detected = read("en", image), "en"
        elif not letters:
            detected = language if language != "auto" else "unknown"
        else:
            detected = "ne" if latin / letters < 0.15 else ("en" if devanagari / letters < DEVANAGARI_MIN_SHARE else "mixed")
    timings["read"] = time.perf_counter() - started

    regions: list[dict] = []
    if with_layout and lines:
        started = time.perf_counter()
        regions = layout(image)
        timings["layout"] = time.perf_counter() - started
    return {"width": width, "height": height, "language": detected, "lines": lines, "regions": regions, "timings": timings}


def orientation(data: bytes) -> dict:
    """How far the page's content is turned clockwise (0, 90, 180 or 270), and how sure that is."""
    import cv2
    import numpy as np

    image = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR | cv2.IMREAD_IGNORE_ORIENTATION)
    if image is None:
        raise ValueError("decode")
    result = model("orientation").predict(image)[0]
    angle, score = int(result["label_names"][0]), float(result["scores"][0])
    return {"angle": angle if score >= ORIENTATION_MIN_SCORE else 0, "score": score}


@app.post("/orientation")
async def detect_orientation(file: UploadFile = File(...), x_internal_token: str | None = Header(default=None)):
    if not authorised(x_internal_token):
        return error(401, "UNAUTHORIZED", "Unauthorized.")
    if not state["ready"]:
        return error(503, "OCR_UNAVAILABLE", "Text recognition is temporarily unavailable.")
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        return error(413, "FILE_TOO_LARGE", "The image is too large.")
    await run_in_threadpool(work_lock.acquire)
    try:
        return await run_in_threadpool(orientation, data)
    except ValueError:
        return error(422, "INVALID_IMAGE", "The file could not be read as an image.")
    except Exception:  # noqa: BLE001
        log.exception("orientation failed")
        return error(500, "PROCESSING_FAILED", "Orientation detection failed.")
    finally:
        work_lock.release()


@app.post("/ocr")
async def ocr(
    file: UploadFile = File(...),
    language: str = Form("auto"),
    layout_analysis: bool = Form(True),
    x_internal_token: str | None = Header(default=None),
):
    if not authorised(x_internal_token):
        return error(401, "UNAUTHORIZED", "Unauthorized.")
    if not state["ready"]:
        return error(503, "OCR_UNAVAILABLE", "Text recognition is temporarily unavailable.")
    if language not in ("auto", "en", "ne", "mixed"):
        return error(400, "INVALID_REQUEST", "Unsupported language.")
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        return error(413, "FILE_TOO_LARGE", "The image is too large.")
    await run_in_threadpool(work_lock.acquire)
    started = time.perf_counter()
    try:
        result = await run_in_threadpool(recognise, data, language, layout_analysis)
    except ValueError:
        return error(422, "INVALID_IMAGE", "The file could not be read as an image.")
    except Exception:  # noqa: BLE001
        log.exception("recognition failed")
        return error(500, "PROCESSING_FAILED", "Text recognition failed.")
    finally:
        work_lock.release()
    # Sizes and timings only — never the text itself.
    log.info("read %sx%s: %d lines, %d regions in %.2fs", result["width"], result["height"], len(result["lines"]), len(result["regions"]), time.perf_counter() - started)
    return result
