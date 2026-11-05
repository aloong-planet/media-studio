#!/bin/sh
# Starts a new video: copies the template and the reference voice into a new directory and installs its packages.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
target=${1:?usage: new-project.sh <new or empty directory>}
voice="$here/voices/ref-tanya-s45.wav"
if [ ! -f "$voice" ]; then
  echo "Missing $voice. The voice is kept out of git, so it does not arrive with a clone: ask the owner." >&2
  exit 1
fi
if [ -e "$target" ] && [ -n "$(ls -A "$target")" ]; then
  echo "Refusing to write into $target: it is not empty." >&2
  exit 1
fi
mkdir -p "$target/voices"
cp -R "$here/template/." "$target/"
cp "$voice" "$target/voices/"
cd "$target"
find src scripts -type f ! -path 'src/data/*' ! -path '*/__pycache__/*' | sort | xargs shasum -a 256 > template-sums.txt
pnpm install
# The renderer's browser is a 140 MB download that a bad connection can break: one download per machine is enough.
browser="$HOME/.cache/video-tutorial/chrome-headless-shell"
if [ -f "$browser/VERSION" ]; then
  mkdir -p node_modules/.remotion
  cp -R "$browser" node_modules/.remotion/chrome-headless-shell
fi
echo "Ready: $target"
