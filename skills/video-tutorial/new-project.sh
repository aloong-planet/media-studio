#!/bin/sh
# Starts a new video: copies the template and the chosen voice into a new directory and installs its packages.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
usage="usage: new-project.sh <new or empty directory> <voice name>"
target=${1:?$usage}
name=${2:?$usage}
voices="$HOME/.video-tutorial/voices"
voice="$voices/$name.wav"
words="$voices/$name.txt"
if [ ! -f "$voice" ] || [ ! -f "$words" ]; then
  echo "No voice named $name. Voices on this machine: $(ls "$voices" 2>/dev/null | sed -n 's/\.wav$//p' | tr '\n' ' ')" >&2
  echo "Voices are kept in $voices. Add one with add_voice.py, in the same folder as this script." >&2
  exit 1
fi
if [ -e "$target" ] && [ -n "$(ls -A "$target")" ]; then
  echo "Refusing to write into $target: it is not empty." >&2
  exit 1
fi
mkdir -p "$target/voices"
cp -R "$here/template/." "$target/"
cp "$voice" "$target/voices/"
node -e '
const fs = require("fs");
const [file, ref, words] = process.argv.slice(1);
const said = fs.readFileSync(words, "utf8").trim();
const script = fs.readFileSync(file, "utf8")
  .replace(/"ref": "[^"]*"/, () => `"ref": ${JSON.stringify(ref)}`)
  .replace(/"refText": "[^"]*"/, () => `"refText": ${JSON.stringify(said)}`);
fs.writeFileSync(file, script);
' "$target/src/data/script.json" "voices/$name.wav" "$words"
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
