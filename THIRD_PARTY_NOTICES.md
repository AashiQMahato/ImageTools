# Third-party notices

Studio Tools runs open-source image-processing engines **locally, on the server**. Nothing here is sent to a third-party service. This file records what is used, where it comes from, and its licence. It is not legal advice — review it before you package or deploy the product commercially.

## Background removal — rembg

| | |
| --- | --- |
| Project | [rembg](https://github.com/danielgatis/rembg) by Daniel Gatis |
| Version | 2.0.85 (pinned in `backend/python/rembg_service/requirements.txt`) |
| Licence | MIT |
| Used as | Python library inside our internal service (`backend/python/rembg_service`) |
| Runtime | [ONNX Runtime](https://github.com/microsoft/onnxruntime) (MIT) |

Security: 2.0.85 is later than every published rembg advisory, including the `/api/remove` URL SSRF fix (2.0.77) and the SAM `extras.sam_model` injection (only reachable through rembg's own HTTP server). This project does not use rembg's HTTP server, its URL input, SAM, or any request-supplied model name.

### rembg models

The model is chosen by the server operator with `REMBG_MODEL`. **Model weights carry their own licences**, separate from rembg's:

| `REMBG_MODEL` | Model | Licence | Commercial use |
| --- | --- | --- | --- |
| `bria-rmbg` (code default) | BRIA RMBG-2.0 | CC BY-NC 4.0 ([model card](https://huggingface.co/briaai/RMBG-2.0)) | **No** — requires a commercial agreement with BRIA AI |
| `birefnet-general`, `birefnet-general-lite`, `birefnet-portrait` | BiRefNet (Zheng Peng et al.) | MIT | Yes |
| `isnet-general-use` | DIS / IS-Net (Xuebin Qin et al.) | Apache-2.0 | Yes |
| `u2net`, `u2netp` | U²-Net (Xuebin Qin et al.) | Apache-2.0 | Yes |

Weights are downloaded by rembg from its GitHub releases on first use and cached under `backend/python/.models/` (not committed).

## Upscaling — Upscayl / upscayl-ncnn

| | |
| --- | --- |
| Project | [upscayl-ncnn](https://github.com/upscayl/upscayl-ncnn) — the processing backend of [Upscayl](https://github.com/upscayl/upscayl) |
| Version | release `20251207-174704`, binary `upscayl-bin` (SHA-256 verified by `scripts/setup-ml.sh`) |
| Licence | **GNU AGPL-3.0** (the upstream `LICENSE` is kept next to the binary in `backend/vendor/upscayl/`) |
| Used as | Unmodified executable, launched by the API as a separate process |
| Built on | [NCNN](https://github.com/Tencent/ncnn) (BSD-3-Clause) and [Real-ESRGAN-ncnn-vulkan](https://github.com/xinntao/Real-ESRGAN-ncnn-vulkan) / [Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN) (BSD-3-Clause); on macOS, Vulkan runs through [MoltenVK](https://github.com/KhronosGroup/MoltenVK) (Apache-2.0) |

AGPL-3.0 note: we run the upstream binary unmodified. If you modify upscayl-ncnn and let users interact with it over a network, AGPL §13 requires offering them the corresponding source. Upstream source: https://github.com/upscayl/upscayl-ncnn.

### Upscayl models

Downloaded by `scripts/setup-ml.sh` from the Upscayl repository at commit `4f39acfc6f88260d105920a64deff8431d5e1544` (v2.15.0) into `backend/vendor/upscayl/models/` (not committed).

| Model | Installed | Notes |
| --- | --- | --- |
| `upscayl-standard-4x` (default) | Yes | Distributed by Upscayl; not marked non-commercial by Upscayl. |
| `upscayl-lite-4x` | Yes | Distributed by Upscayl; not marked non-commercial by Upscayl. Much faster. |
| `digital-art-4x` | Yes | Distributed by Upscayl; not marked non-commercial by Upscayl. |
| `remacri-4x`, `ultramix-balanced-4x`, `ultrasharp-4x` | **No** | Upscayl labels these "Non-Commercial" (Foolhardy; Kim2091). |
| `high-fidelity-4x` (`hfa2k-4x`) | No | Licence not confirmed. |

Upscayl does not publish a separate licence for each bundled weight file. Confirm the terms of the model you enable before commercial use.

## Photo generator — face detection and HEIC decoding

| | |
| --- | --- |
| Face detection | [OpenCV](https://github.com/opencv/opencv) via `opencv-python-headless` 5.0 (Apache-2.0), running the [YuNet](https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet) model `face_detection_yunet_2023mar.onnx` (MIT) |
| HEIC/HEIF decoding | [pillow-heif](https://github.com/bigcat88/pillow_heif) 1.8 (BSD-3-Clause) |
| Used as | Python libraries inside our internal service (`backend/python/rembg_service`) |

The YuNet weights are downloaded by `scripts/setup-ml.sh` from the OpenCV model zoo (checksum-verified) into `backend/python/.models/` (not committed).

**Check before distributing:** pillow-heif's binary wheels bundle libheif and libde265 (LGPL-3.0) and, for encoding, x265 (GPL-2.0). Running them on your own server is different from shipping them to others; if you package or redistribute the backend, review those licences. HEVC (the codec inside HEIC) is also covered by patents in some countries.

## Watermark remover and Retouch — text detection and inpainting

| | |
| --- | --- |
| Text detection | [PP-OCRv3](https://github.com/opencv/opencv_zoo/tree/main/models/text_detection_ppocr) detector, `text_detection_en_ppocrv3_2023may.onnx` (Apache-2.0), run by OpenCV |
| Inpainting | [LaMa](https://github.com/advimman/lama) (Apache-2.0), ONNX export [`Carve/LaMa-ONNX`](https://huggingface.co/Carve/LaMa-ONNX) `lama_fp32.onnx` (Apache-2.0), run by ONNX Runtime (MIT) |
| Used as | Models inside our internal service (`backend/python/rembg_service`) |

Both are downloaded by `scripts/setup-ml.sh` (checksum-verified) into `backend/python/.models/` (not committed). The watermark remover is meant for images the user owns or may edit; the UI says so.

## OCR editor — PaddleOCR

| | |
| --- | --- |
| Project | [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) 3.7.0 and [PaddlePaddle](https://github.com/PaddlePaddle/Paddle) 3.3.1 (pinned in `backend/python/ocr_service/requirements.txt`) |
| Licence | Apache-2.0 (both) |
| Models | PP-OCRv5 mobile detection, PP-OCRv6 medium recognition (English), Devanagari PP-OCRv5 mobile recognition, PP-DocLayout_plus-L, PP-LCNet_x1_0_doc_ori (page orientation) — Apache-2.0, downloaded by `scripts/setup-ml.sh` into `backend/python/.models/paddlex/` (not committed) |
| Used as | Python libraries inside our internal service (`backend/python/ocr_service`) |

Optional fallback: [Tesseract](https://github.com/tesseract-ocr/tesseract) (Apache-2.0), used only if installed on the machine. PDFs are opened in the browser with [PDF.js](https://github.com/mozilla/pdf.js) (Apache-2.0) — only rendered pages are sent to be read. The editor uses [Tiptap](https://tiptap.dev) (MIT) and [docx](https://github.com/dolanmiu/docx) (MIT); text is set in Inter and Noto Sans/Serif (Devanagari) — SIL Open Font Licence, served by Google Fonts.

## Document tools — PDF processing

| | |
| --- | --- |
| Editing | [pdf-lib](https://github.com/Hopding/pdf-lib) (MIT) — merge, split, organize, rotate, images → PDF |
| Rendering | [pypdfium2](https://github.com/pypdfium2-team/pypdfium2) (Apache-2.0 / BSD-3-Clause) with [PDFium](https://pdfium.googlesource.com/pdfium/) (BSD-3-Clause), inside our internal service (`backend/python/rembg_service`) |
| Archives | [fflate](https://github.com/101arrowz/fflate) (MIT) — ZIP downloads, streamed |
| Compression | [pikepdf](https://github.com/pikepdf/pikepdf) (MPL-2.0) with [qpdf](https://github.com/qpdf/qpdf) (Apache-2.0), inside our internal service |
| Nepali stamps | [Noto Sans Devanagari](https://github.com/notofonts/devanagari) (SIL Open Font License 1.1; licence in `backend/assets/fonts/OFL.txt`), shaped by HarfBuzz/Pango through sharp (LGPL-3.0 libvips, dynamically linked) |
| Previews | PDF.js (Apache-2.0), in the browser |

## Frontend

UI built with [Untitled UI React](https://www.untitledui.com/react) (MIT), [React Aria Components](https://react-spectrum.adobe.com/react-aria/) (Apache-2.0), [Lucide](https://lucide.dev) (ISC) and Tailwind CSS (MIT). Landing-page photography is CC0 — see `frontend/src/assets/images/landing/CREDITS.md`.
