#!/usr/bin/env bash
# Sets up local image processing for Image Tools:
#   1. A Python virtualenv with rembg (background removal) and its model.
#   2. The official upscayl-ncnn binary ("upscayl-bin") and Upscayl's models (upscaling).
#
# Nothing is installed system-wide. Everything lands under backend/python/ and backend/vendor/ (both git-ignored).
# The script explains what it will download and asks before doing it (pass --yes to skip the prompt).
#
# Usage: scripts/setup-ml.sh [--yes] [--skip-rembg] [--skip-upscayl] [--rembg-model <name>]

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/backend"
PY_DIR="$BACKEND/python"
VENV="$PY_DIR/.venv"
MODELS_HOME="$PY_DIR/.models"
VENDOR="$BACKEND/vendor/upscayl"

# Pinned upstream versions. Update deliberately, together with the digests.
UPSCAYL_BIN_TAG="20251207-174704"
declare_digest() {
  case "$1" in
    macos) echo "277419791281a56eae0c739c70120b974d7267cf7c2de8e86dc09798d4b314db" ;;
    linux) echo "a9fab3c770b62f2b7a35d8d6d61eb4e8b3aef79128b665c919d080b85a2292f2" ;;
    *) echo "" ;;
  esac
}
# Upscayl v2.15.0. Only models without a non-commercial label from Upscayl are fetched (see THIRD_PARTY_NOTICES.md).
UPSCAYL_MODELS_COMMIT="4f39acfc6f88260d105920a64deff8431d5e1544"
UPSCAYL_MODELS=(upscayl-standard-4x upscayl-lite-4x digital-art-4x)

ASSUME_YES=false
SKIP_REMBG=false
SKIP_UPSCAYL=false
REMBG_MODEL="${REMBG_MODEL:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes|-y) ASSUME_YES=true ;;
    --skip-rembg) SKIP_REMBG=true ;;
    --skip-upscayl) SKIP_UPSCAYL=true ;;
    --rembg-model) REMBG_MODEL="$2"; shift ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
ok() { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$*"; }

# Read a key from backend/.env if present (without sourcing the file).
env_value() {
  [[ -f "$BACKEND/.env" ]] || return 0
  grep -E "^$1=" "$BACKEND/.env" | tail -1 | cut -d= -f2- | tr -d '"' || true
}
[[ -z "$REMBG_MODEL" ]] && REMBG_MODEL="$(env_value REMBG_MODEL)"
REMBG_MODEL="${REMBG_MODEL:-bria-rmbg}"

OS="$(uname -s)"
ARCH="$(uname -m)"
case "$OS" in
  Darwin) PLATFORM=macos ;;
  Linux) PLATFORM=linux ;;
  *) PLATFORM=unsupported ;;
esac

bold "Image Tools — processing setup"
echo "  Platform: $OS $ARCH"
echo
echo "This will:"
$SKIP_REMBG || echo "  • create $VENV and install backend/python/rembg_service/requirements.txt"
$SKIP_REMBG || echo "  • download the rembg model '$REMBG_MODEL' into $MODELS_HOME"
$SKIP_UPSCAYL || echo "  • download upscayl-bin $UPSCAYL_BIN_TAG ($PLATFORM) from github.com/upscayl/upscayl-ncnn and verify its SHA-256"
$SKIP_UPSCAYL || echo "  • download Upscayl models (${UPSCAYL_MODELS[*]}) from github.com/upscayl/upscayl @ ${UPSCAYL_MODELS_COMMIT:0:7}"
echo
if ! $ASSUME_YES; then
  read -r -p "Continue? [y/N] " answer
  [[ "$answer" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 1; }
fi

# ---------------------------------------------------------------- rembg

find_python() {
  if command -v uv >/dev/null 2>&1; then echo "uv"; return; fi
  for candidate in python3.13 python3.12 python3.11 python3; do
    if command -v "$candidate" >/dev/null 2>&1; then
      if "$candidate" -c 'import sys; sys.exit(0 if (3, 11) <= sys.version_info[:2] < (3, 14) else 1)' 2>/dev/null; then
        echo "$candidate"; return
      fi
    fi
  done
}

if ! $SKIP_REMBG; then
  echo; bold "Background removal (rembg)"
  PY="$(find_python)"
  if [[ -z "$PY" ]]; then
    fail "No Python between 3.11 and 3.13 found (rembg requires >=3.11,<3.14)."
    echo "    Install one (e.g. 'brew install python@3.12' or 'uv python install 3.12') and re-run."
    exit 1
  fi
  if [[ "$PY" == "uv" ]]; then
    [[ -x "$VENV/bin/python" ]] || uv venv -q --python 3.12 "$VENV"
    uv pip install -q --python "$VENV/bin/python" -r "$PY_DIR/rembg_service/requirements.txt"
  else
    [[ -x "$VENV/bin/python" ]] || "$PY" -m venv "$VENV"
    "$VENV/bin/python" -m pip install -q --upgrade pip
    "$VENV/bin/python" -m pip install -q -r "$PY_DIR/rembg_service/requirements.txt"
  fi
  ok "Python $("$VENV/bin/python" -c 'import platform; print(platform.python_version())'), rembg $("$VENV/bin/python" -c 'import importlib.metadata as m; print(m.version("rembg"))')"

  echo "  Downloading model '$REMBG_MODEL' (can be large; first run only)…"
  U2NET_HOME="$MODELS_HOME" "$VENV/bin/python" -c "from rembg import new_session; new_session('$REMBG_MODEL', providers=['CPUExecutionProvider'])" >/dev/null
  ok "Model '$REMBG_MODEL' ready"

  # Face detection for the photo generator: OpenCV's YuNet (MIT), from the OpenCV model zoo.
  FACE_MODEL="$MODELS_HOME/face_detection_yunet_2023mar.onnx"
  FACE_MODEL_SHA256="8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4"
  if [[ ! -s "$FACE_MODEL" ]]; then
    curl -fsSL "https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx" -o "$FACE_MODEL.part"
    if [[ "$(shasum -a 256 "$FACE_MODEL.part" | cut -d' ' -f1)" != "$FACE_MODEL_SHA256" ]]; then
      rm -f "$FACE_MODEL.part"
      fail "Face detection model checksum mismatch; not installed."
      exit 1
    fi
    mv "$FACE_MODEL.part" "$FACE_MODEL"
  fi
  ok "Face detection model (YuNet) ready"
fi

# ---------------------------------------------------------------- Upscayl

if ! $SKIP_UPSCAYL; then
  echo; bold "Upscaling (upscayl-ncnn)"
  if [[ "$PLATFORM" == "unsupported" ]]; then
    fail "This script supports macOS and Linux. On Windows, download upscayl-bin-$UPSCAYL_BIN_TAG-windows.zip from"
    echo "    https://github.com/upscayl/upscayl-ncnn/releases/tag/$UPSCAYL_BIN_TAG and set UPSCAYL_BINARY_PATH."
    exit 1
  fi

  if [[ "$PLATFORM" == "linux" ]]; then
    if ldconfig -p 2>/dev/null | grep -q "libvulkan.so.1"; then
      ok "Vulkan loader found (libvulkan.so.1)"
    else
      fail "Vulkan loader (libvulkan.so.1) not found. Install your distro's Vulkan loader and a Vulkan-capable GPU driver"
      echo "    (e.g. 'sudo apt install libvulkan1 mesa-vulkan-drivers'), then re-run. Upscaling will report as unavailable until then."
    fi
  else
    ok "macOS: upscayl-bin bundles MoltenVK (Vulkan on Metal)"
  fi

  mkdir -p "$VENDOR/models"
  BIN="$VENDOR/upscayl-bin"
  if [[ -x "$BIN" ]]; then
    ok "upscayl-bin already present"
  else
    ZIP_NAME="upscayl-bin-$UPSCAYL_BIN_TAG-$PLATFORM.zip"
    URL="https://github.com/upscayl/upscayl-ncnn/releases/download/$UPSCAYL_BIN_TAG/$ZIP_NAME"
    TMP="$(mktemp -d)"
    trap 'rm -rf "$TMP"' EXIT
    curl -fsSL "$URL" -o "$TMP/$ZIP_NAME"
    EXPECTED="$(declare_digest "$PLATFORM")"
    ACTUAL="$(shasum -a 256 "$TMP/$ZIP_NAME" | cut -d' ' -f1)"
    if [[ "$ACTUAL" != "$EXPECTED" ]]; then
      fail "Checksum mismatch for $ZIP_NAME (expected $EXPECTED, got $ACTUAL). Not installing."
      exit 1
    fi
    ok "Downloaded and verified $ZIP_NAME"
    unzip -q "$TMP/$ZIP_NAME" -d "$TMP/unzipped"
    FOUND="$(find "$TMP/unzipped" -type f -name 'upscayl-bin' | head -1)"
    [[ -n "$FOUND" ]] || { fail "upscayl-bin not found inside the archive"; exit 1; }
    cp "$FOUND" "$BIN"
    chmod +x "$BIN"
    # Keep upstream licence/notice files next to the binary.
    find "$TMP/unzipped" -maxdepth 3 -type f \( -iname 'LICENSE*' -o -iname 'NOTICE*' -o -iname 'README*' \) -exec cp {} "$VENDOR/" \; 2>/dev/null || true
    ok "Installed upscayl-bin into backend/vendor/upscayl/"
  fi

  for model in "${UPSCAYL_MODELS[@]}"; do
    for ext in param bin; do
      target="$VENDOR/models/$model.$ext"
      [[ -s "$target" ]] && continue
      curl -fsSL "https://raw.githubusercontent.com/upscayl/upscayl/$UPSCAYL_MODELS_COMMIT/resources/models/$model.$ext" -o "$target.part"
      mv "$target.part" "$target"
    done
    ok "Model $model"
  done

  # Real probe: upscale a tiny image. This is what actually proves Vulkan/GPU support.
  PROBE="$(mktemp -d)"
  if [[ -x "$VENV/bin/python" ]]; then
    "$VENV/bin/python" -c "from PIL import Image; Image.new('RGB', (16, 16), (120, 90, 60)).save('$PROBE/in.png')"
  else
    warn "Skipping probe image generation (no Python venv); run scripts/check-processing.sh after setup."
  fi
  if [[ -f "$PROBE/in.png" ]]; then
    if "$BIN" -i "$PROBE/in.png" -o "$PROBE/out.png" -m "$VENDOR/models" -n upscayl-standard-4x -s 4 -f png >"$PROBE/log" 2>&1 && [[ -s "$PROBE/out.png" ]]; then
      GPU="$(grep -Eo '^\[[0-9]+ [^]]+\]' "$PROBE/log" | head -1 | sed -E 's/^\[[0-9]+ (.*)\]$/\1/')"
      ok "Upscaling works on this machine${GPU:+ (GPU: $GPU)}"
    else
      fail "upscayl-bin could not run. Most likely no Vulkan-capable GPU/driver is available. Last lines:"
      tail -5 "$PROBE/log" | sed 's/^/    /'
    fi
  fi
  rm -rf "$PROBE"
fi

echo
bold "Done."
echo "  Start the API with 'npm run dev' in backend/ — it launches the rembg service automatically."
echo "  Check status any time with scripts/check-processing.sh"
