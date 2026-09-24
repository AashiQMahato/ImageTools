# Third-party notices

Image Tools runs two open-source image-processing engines **locally, on the server**. Nothing here is sent to a third-party service. This file records what is used, where it comes from, and its licence. It is not legal advice — review it before you package or deploy the product commercially.

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

## Frontend

UI built with [Untitled UI React](https://www.untitledui.com/react) (MIT), [React Aria Components](https://react-spectrum.adobe.com/react-aria/) (Apache-2.0), [Lucide](https://lucide.dev) (ISC) and Tailwind CSS (MIT). Landing-page photography is CC0 — see `frontend/src/assets/images/landing/CREDITS.md`.
