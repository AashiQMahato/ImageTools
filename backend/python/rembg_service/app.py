"""
Internal image service for Image Tools: background removal, format conversion and face detection.

- Loads one rembg session at startup and reuses it for every request.
- Converts formats the Node side can't decode (HEIC/HEIF, BMP…) to JPEG, orientation applied.
- Detects faces with OpenCV's YuNet model (boxes, eye/nose/mouth landmarks, sharpness, brightness).
- Accepts direct image uploads only (no URL fetching).
- Binds to localhost and requires a shared token, so only the Node API can use it.
- Never returns stack traces, paths or model internals to the caller.
"""

from __future__ import annotations

import hmac
import io
import logging
import os
import threading
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Form, Header, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse, Response
from PIL import Image, ImageOps, UnidentifiedImageError

try:  # HEIC/HEIF (and AVIF) decoding for Pillow.
    import pillow_heif

    pillow_heif.register_heif_opener()
except ImportError:  # pragma: no cover — conversion of those formats is then reported as unsupported
    pillow_heif = None

# Models this service may load. The model is chosen by the server operator (REMBG_MODEL), never by a request.
ALLOWED_MODELS = {
    "bria-rmbg",
    "birefnet-general",
    "birefnet-general-lite",
    "birefnet-portrait",
    "isnet-general-use",
    "u2net",
    "u2netp",
    "silueta",
}

MODEL_NAME = os.environ.get("REMBG_MODEL", "bria-rmbg").strip()
TOKEN = os.environ.get("INTERNAL_SERVICE_TOKEN", "")
MAX_BYTES = int(float(os.environ.get("MAX_IMAGE_SIZE_MB", "10")) * 1024 * 1024)
MAX_PIXELS = int(os.environ.get("MAX_IMAGE_PIXELS", str(40_000_000)))
CONCURRENCY = max(1, int(os.environ.get("BACKGROUND_REMOVAL_CONCURRENCY", "2")))
# Decontamination removes background colour bleeding into semi-transparent edges.
DEFAULT_DECONTAMINATE = os.environ.get("REMBG_DECONTAMINATE", "true").lower() == "true"
DEFAULT_ALPHA_MATTING = os.environ.get("REMBG_ALPHA_MATTING", "false").lower() == "true"
# CPU by default: on macOS, onnxruntime's CoreML provider takes minutes to compile these graphs and runs
# them slower than the CPU. Set REMBG_PROVIDERS (comma-separated onnxruntime providers) to override.
PROVIDERS = [p.strip() for p in os.environ.get("REMBG_PROVIDERS", "CPUExecutionProvider").split(",") if p.strip()]

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
# What /convert accepts. Decided by Pillow from the file's content, never from its name.
CONVERTIBLE_FORMATS = ALLOWED_FORMATS | {"HEIF", "AVIF", "TIFF", "BMP", "GIF", "MPO"}

# OpenCV YuNet face detector (downloaded by scripts/setup-ml.sh).
FACE_MODEL = os.environ.get("FACE_DETECTOR_MODEL") or os.path.join(os.environ.get("U2NET_HOME", ""), "face_detection_yunet_2023mar.onnx")
# Faces are found on a copy no larger than this; coordinates are reported at full size.
FACE_DETECT_MAX_SIDE = 1280

# Pillow refuses images above this many pixels (decompression-bomb protection).
Image.MAX_IMAGE_PIXELS = MAX_PIXELS

logging.basicConfig(level=logging.INFO, format="[rembg] %(levelname)s %(message)s")
log = logging.getLogger("rembg_service")

state: dict[str, object] = {"session": None, "error": None, "loaded_at": None}
slots = threading.BoundedSemaphore(CONCURRENCY)


def error(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"success": False, "code": code, "message": message})


def watch_parent() -> None:
    """Exit if the Node process that launched us goes away, so no orphaned model process is left running."""
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


@asynccontextmanager
async def lifespan(_: FastAPI):
    watch_parent()
    if MODEL_NAME not in ALLOWED_MODELS:
        state["error"] = "unsupported-model"
        log.error("REMBG_MODEL '%s' is not in the allowed list", MODEL_NAME)
    else:
        started = time.perf_counter()
        try:
            from rembg import new_session

            state["session"] = await run_in_threadpool(lambda: new_session(MODEL_NAME, providers=PROVIDERS))
            state["loaded_at"] = time.time()
            log.info("model '%s' ready in %.1fs", MODEL_NAME, time.perf_counter() - started)
        except Exception:  # noqa: BLE001 — logged server-side, reported generically
            state["error"] = "model-load-failed"
            log.exception("failed to load model '%s'", MODEL_NAME)
    yield


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


def authorised(token: str | None) -> bool:
    return bool(TOKEN) and token is not None and hmac.compare_digest(token, TOKEN)


@app.get("/health")
async def health(x_internal_token: str | None = Header(default=None)):
    if not authorised(x_internal_token):
        return error(401, "UNAUTHORIZED", "Unauthorized.")
    return {
        "ready": state["session"] is not None,
        "model": MODEL_NAME,
        "error": state["error"],
    }


def decode(data: bytes) -> Image.Image:
    """Fully decode the upload, reject anything that isn't a real JPEG/PNG/WebP, and apply EXIF orientation."""
    with Image.open(io.BytesIO(data)) as probe:
        if probe.format not in ALLOWED_FORMATS:
            raise ValueError("format")
        probe.verify()
    image = Image.open(io.BytesIO(data))
    image.load()
    image = ImageOps.exif_transpose(image)
    return image.convert("RGBA") if image.mode not in ("RGB", "RGBA") else image


def process(image: Image.Image, alpha_matting: bool, decontaminate: bool) -> bytes:
    from rembg import remove

    result = remove(
        image,
        session=state["session"],
        alpha_matting=alpha_matting,
        decontaminate=decontaminate,
        post_process_mask=False,
    )
    buffer = io.BytesIO()
    result.save(buffer, format="PNG", optimize=False, compress_level=6)
    return buffer.getvalue()


@app.post("/remove-background")
async def remove_background(
    file: UploadFile = File(...),
    alpha_matting: bool = Form(DEFAULT_ALPHA_MATTING),
    decontaminate: bool = Form(DEFAULT_DECONTAMINATE),
    x_internal_token: str | None = Header(default=None),
):
    if not authorised(x_internal_token):
        return error(401, "UNAUTHORIZED", "Unauthorized.")
    if state["session"] is None:
        return error(503, "BACKGROUND_REMOVAL_UNAVAILABLE", "Background removal is temporarily unavailable.")

    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        return error(413, "FILE_TOO_LARGE", "The image is too large.")

    try:
        image = await run_in_threadpool(decode, data)
    except (UnidentifiedImageError, ValueError, OSError, Image.DecompressionBombError):
        return error(422, "INVALID_IMAGE", "The file could not be read as an image.")

    # Bound concurrent model runs; wait for a slot off the event loop.
    await run_in_threadpool(slots.acquire)
    started = time.perf_counter()
    try:
        png = await run_in_threadpool(process, image, alpha_matting, decontaminate)
    except Exception:  # noqa: BLE001
        log.exception("background removal failed")
        return error(500, "PROCESSING_FAILED", "Background removal failed.")
    finally:
        slots.release()

    log.info("processed %sx%s in %.2fs", image.width, image.height, time.perf_counter() - started)
    return Response(
        content=png,
        media_type="image/png",
        headers={"X-Image-Width": str(image.width), "X-Image-Height": str(image.height)},
    )


# ---------------------------------------------------------------- format conversion


def open_any(data: bytes) -> tuple[Image.Image, str, int]:
    """Decode any convertible format, fully, with EXIF orientation applied. Returns (image, format, original orientation)."""
    with Image.open(io.BytesIO(data)) as probe:
        source_format = probe.format or ""
        if source_format not in CONVERTIBLE_FORMATS:
            raise ValueError("format")
    image = Image.open(io.BytesIO(data))
    if getattr(image, "n_frames", 1) > 1:
        image.seek(0)  # animated GIF/WebP: the first frame
    image.load()
    # HEIF decoding already turns the image upright and resets the tag, keeping the original aside.
    orientation = int(image.info.get("original_orientation") or image.getexif().get(0x0112, 1) or 1)
    image = ImageOps.exif_transpose(image)
    return image, source_format, orientation


def to_jpeg(image: Image.Image) -> bytes:
    """Highest-quality JPEG of the image: transparency flattened onto white, colour profile kept."""
    icc = image.info.get("icc_profile")
    if image.mode in ("RGBA", "LA", "PA") or (image.mode == "P" and "transparency" in image.info):
        rgba = image.convert("RGBA")
        flat = Image.new("RGB", rgba.size, (255, 255, 255))
        flat.paste(rgba, mask=rgba.getchannel("A"))
        image = flat
    elif image.mode != "RGB":
        image = image.convert("RGB")
    buffer = io.BytesIO()
    options = {"quality": 95, "subsampling": 0, "optimize": True}
    if icc:
        options["icc_profile"] = icc
    image.save(buffer, format="JPEG", **options)
    return buffer.getvalue()


@app.post("/convert")
async def convert(file: UploadFile = File(...), x_internal_token: str | None = Header(default=None)):
    if not authorised(x_internal_token):
        return error(401, "UNAUTHORIZED", "Unauthorized.")
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        return error(413, "FILE_TOO_LARGE", "The image is too large.")
    try:
        image, source_format, orientation = await run_in_threadpool(open_any, data)
        jpeg = await run_in_threadpool(to_jpeg, image)
    except ValueError:
        return error(415, "UNSUPPORTED_MEDIA_TYPE", "This image format isn't supported.")
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        return error(422, "INVALID_IMAGE", "The file could not be read as an image.")
    except Exception:  # noqa: BLE001
        log.exception("conversion failed")
        return error(500, "CONVERSION_FAILED", "The image could not be converted.")
    return Response(
        content=jpeg,
        media_type="image/jpeg",
        headers={
            "X-Image-Width": str(image.width),
            "X-Image-Height": str(image.height),
            "X-Source-Format": source_format,
            "X-Source-Orientation": str(orientation),
        },
    )


# ---------------------------------------------------------------- face detection


def detect_faces(data: bytes) -> dict:
    import cv2
    import numpy as np

    pixels = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR | cv2.IMREAD_IGNORE_ORIENTATION)
    if pixels is None:
        raise ValueError("decode")
    height, width = pixels.shape[:2]
    if width * height > MAX_PIXELS:
        raise ValueError("size")
    scale = min(1.0, FACE_DETECT_MAX_SIDE / max(width, height))
    small = cv2.resize(pixels, (max(1, round(width * scale)), max(1, round(height * scale))), interpolation=cv2.INTER_AREA) if scale < 1 else pixels
    detector = cv2.FaceDetectorYN.create(FACE_MODEL, "", (small.shape[1], small.shape[0]), 0.75, 0.3, 50)
    _, found = detector.detect(small)
    gray = cv2.cvtColor(pixels, cv2.COLOR_BGR2GRAY)

    faces = []
    for row in [] if found is None else found:
        values = [float(v) / scale for v in row[:14]]
        x, y, w, h = values[0:4]
        point = lambda i: {"x": values[4 + i * 2], "y": values[5 + i * 2]}  # noqa: E731
        # Quality of the face itself: sharpness (variance of the Laplacian at a fixed size) and brightness.
        left, top = max(0, int(x)), max(0, int(y))
        right, bottom = min(width, int(x + w)), min(height, int(y + h))
        sharpness = brightness = 0.0
        if right - left >= 8 and bottom - top >= 8:
            roi = gray[top:bottom, left:right]
            roi = cv2.resize(roi, (256, max(8, round(256 * roi.shape[0] / roi.shape[1]))), interpolation=cv2.INTER_AREA)
            sharpness = float(cv2.Laplacian(roi, cv2.CV_64F).var())
            brightness = float(roi.mean())
        faces.append(
            {
                "box": {"x": x, "y": y, "width": w, "height": h},
                "score": float(row[14]),
                # YuNet's order: right eye, left eye (the subject's), nose tip, right and left mouth corners.
                "landmarks": {"rightEye": point(0), "leftEye": point(1), "nose": point(2), "mouthRight": point(3), "mouthLeft": point(4)},
                "sharpness": sharpness,
                "brightness": brightness,
            }
        )
    faces.sort(key=lambda face: face["box"]["width"] * face["box"]["height"], reverse=True)
    return {"width": width, "height": height, "faces": faces}


@app.post("/detect-faces")
async def detect(file: UploadFile = File(...), x_internal_token: str | None = Header(default=None)):
    if not authorised(x_internal_token):
        return error(401, "UNAUTHORIZED", "Unauthorized.")
    if not os.path.isfile(FACE_MODEL):
        return error(503, "FACE_DETECTION_UNAVAILABLE", "Face detection isn't set up on this server.")
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        return error(413, "FILE_TOO_LARGE", "The image is too large.")
    try:
        return await run_in_threadpool(detect_faces, data)
    except ValueError:
        return error(422, "INVALID_IMAGE", "The file could not be read as an image.")
    except Exception:  # noqa: BLE001
        log.exception("face detection failed")
        return error(500, "PROCESSING_FAILED", "Face detection failed.")
