"""
Internal background-removal service for Image Tools.

- Loads one rembg session at startup and reuses it for every request.
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
