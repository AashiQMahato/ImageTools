# Image Tools — Backend

Express 5 + TypeScript (strict) API. It is the only thing the browser talks to; the image-processing engines run behind it and are never exposed.

```text
React ──► Express API ──► rembg service (Python, localhost-only, token-protected)
                     └──► upscayl-bin (Upscayl / upscayl-ncnn, spawned per job, no shell)
```

## Setup

```bash
npm install
cp .env.example .env
../scripts/setup-ml.sh          # Python venv + rembg model, Upscayl binary + models (asks before downloading)
npm run dev                     # also launches the rembg service; http://localhost:5000
../scripts/check-processing.sh  # what's ready, and why not
```

`npm run build` compiles to `dist/`; `npm run start` runs it (the rembg service is launched the same way).

On macOS, port 5000 is taken by AirPlay Receiver — disable it or set `PORT=5050` (and `API_PROXY_TARGET=http://localhost:5050` in `frontend/.env`).

## API

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/api/health` | — | `{ success, message, services: { api, backgroundRemoval, upscaling } }` |
| GET | `/api/health/processors` | — | availability, status, model, GPU name, queue, limits (no paths or secrets) |
| POST | `/api/remove-background` | multipart `file` | `image/png` (transparent), same dimensions as the input |
| POST | `/api/upscale` | multipart `file`, `scale` = `2` or `4` | the image at 2×/4×; JPEG stays JPEG, PNG/WebP keep transparency |

Successful responses include `Content-Disposition` (e.g. `photo-no-background.png`, `photo-upscaled-2x.jpg`), `X-Image-Width/Height` and `X-Original-Width/Height`. Errors are JSON: `{ "success": false, "message": "…", "code": "…" }` with codes such as `FILE_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, `INVALID_IMAGE`, `IMAGE_TOO_LARGE`, `INVALID_SCALE`, `SERVER_BUSY`, `PROCESSING_TIMEOUT`, `BACKGROUND_REMOVAL_UNAVAILABLE`, `UPSCALING_UNAVAILABLE`, `RATE_LIMITED`.

```bash
curl -X POST -F "file=@photo.jpg" http://localhost:5000/api/remove-background --output photo-no-background.png
curl -X POST -F "file=@photo.jpg" -F "scale=2" http://localhost:5000/api/upscale --output photo-upscaled-2x.jpg
```

## How requests are handled

1. **Rate limit** (`PROCESSING_RATE_LIMIT` per 15 min) → **multer** (memory only, size limit, one file).
2. **Validation** (`services/image-processing/imageValidation.service.ts`): extension and declared type, real format from the file signature, then a full decode with a pixel limit.
3. **Concurrency limiter** per engine (`BACKGROUND_REMOVAL_CONCURRENCY`, `UPSCALE_CONCURRENCY`) with a bounded queue (`PROCESSING_MAX_QUEUE`) → `SERVER_BUSY` when full.
4. **Engine**
   - rembg: HTTP to the internal service, with a timeout (`REMBG_TIMEOUT_MS`).
   - Upscayl: a private `mkdtemp` directory per request, EXIF-oriented PNG written with a fixed name, `upscayl-bin` spawned with an argument array (no shell), killed on timeout (`UPSCALE_TIMEOUT_MS`) or client disconnect, directory always deleted.
5. The result is streamed back. Nothing is stored.

If a client disconnects mid-request, its job is cancelled (queued jobs never start; a running upscale is killed).

## Structure

```text
src/
├── config/          env (all settings), upload rules
├── controllers/     background removal, upscale, health
├── middleware/      rate limiters, upload, error handler (safe messages only)
├── routes/          /api router
├── services/
│   ├── background-removal/   rembgProcess (lifecycle), rembgProvider, service (+ limiter)
│   ├── upscaling/            upscaylProvider (probe, spawn, encode), service (+ limiter)
│   └── image-processing/     imageValidation.service
└── utils/           AppError, ConcurrencyLimiter, withTempDir, http helpers
python/rembg_service/  internal FastAPI service (see its README)
vendor/upscayl/        upscayl-bin + models (installed by scripts/setup-ml.sh; git-ignored)
```

Swap engines by implementing `BackgroundRemovalProvider` / `UpscaleProvider` (`src/types/image.ts`). A hosted upscaling fallback would plug into `services/upscaling/upscaleService.ts`, keyed by `UPSCAYL_API_KEY` (server-side only); none is enabled.

See `.env.example` for every setting and [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) for licences.
