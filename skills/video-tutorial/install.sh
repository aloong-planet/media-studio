#!/bin/sh
# Prepares this machine for video-tutorial: checks the machine and tools, then adds the Python environment and models if they are missing.
set -eu
PATH="$PATH:/usr/sbin"  # sysctl lives here, and a minimal PATH leaves it out.
here=$(cd "$(dirname "$0")" && pwd)

stop() {
  echo "$1" >&2
  exit 1
}

# The narration runs on MLX, which only runs on Apple Silicon: stop before anything is written or downloaded.
[ "$(uname -s)" = Darwin ] || stop "video-tutorial needs an Apple Silicon Mac, and this machine runs $(uname -s)."
[ "$(sysctl -n hw.optional.arm64 2>/dev/null || true)" = 1 ] || stop "video-tutorial needs an Apple Silicon Mac, and this is an Intel Mac."
[ "$(uname -m)" = arm64 ] || stop "This terminal runs under Rosetta. Open a native arm64 terminal and run install.sh again."

missing=""
for tool in node pnpm ffmpeg ffprobe; do
  command -v "$tool" >/dev/null 2>&1 || missing="$missing $tool"
done
[ -z "$missing" ] || stop "Missing:$missing. Install them, for example with Homebrew, and run install.sh again."

env="$HOME/.venv/mlx-tts"
python="$env/bin/python"
unfinished="$env/.video-tutorial-installing"  # Tells an interrupted install from an environment that is not ours to change.

if [ ! -e "$env" ] || [ -f "$unfinished" ]; then
  base=$(command -v python3.12) || stop "Missing: python3.12. Install it, for example with: brew install python@3.12"
  [ "$("$base" -c 'import platform; print(platform.machine())')" = arm64 ] || stop "$base is not an arm64 build. Install an arm64 python3.12 and run install.sh again."
  echo "Installing the Python environment into $env (about 0.6 GB)."
  mkdir -p "$env"
  : > "$unfinished"
  "$base" -m venv "$env"
  "$python" -m pip install --quiet --disable-pip-version-check -r "$here/requirements.txt" || stop "Could not install the Python packages. Run install.sh again to continue."
  rm "$unfinished"
else
  [ -x "$python" ] || stop "$env exists but has no Python. It was left unchanged: decide what to do with it, then run install.sh again."
fi

imports="import mlx.core, mlx_audio.audio_io, mlx_audio.tts.utils, mlx_audio.tts.models.qwen3_tts, mlx_audio.stt.utils, mlx_audio.stt.models.whisper, numpy, pypinyin, huggingface_hub"
# Offline, because some mlx-audio modules download when imported. No bytecode, so an environment that already exists stays as it is.
if ! problem=$(HF_HUB_OFFLINE=1 "$python" -I -B -c "$imports" 2>&1); then
  stop "$env cannot run the narration and was left unchanged: $(printf '%s\n' "$problem" | tail -n 1)"
fi

"$python" -I "$here/install_models.py"

echo "Python environment and models are ready."
ls "$here"/voices/*.wav >/dev/null 2>&1 || echo "No narration voice yet. Add a recording with: $python -I $here/add_voice.py <name> <recording> [the words it says]"
