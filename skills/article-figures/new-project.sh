#!/bin/sh
# Starts an article's figures project in <article directory>/assets/sources/figures and installs its packages.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
article=${1:?"usage: new-project.sh <the article's Markdown file>"}
if [ ! -f "$article" ]; then
  echo "No such article: $article" >&2
  exit 1
fi
target="$(cd "$(dirname "$article")" && pwd)/assets/sources/figures"
if [ -f "$target/package.json" ] && grep -q '"name": "article-figures"' "$target/package.json"; then
  echo "$target already holds a figures project, so nothing was written: work in it."
  exit 0
fi
if [ -e "$target" ] && [ -n "$(ls -A "$target")" ]; then
  echo "Refusing to write into $target: it is not empty and holds no figures project." >&2
  exit 1
fi
mkdir -p "$target"
cp -R "$here/template/." "$target/"
cd "$target"
find src scripts -type f ! -path 'src/data/*' | sort | xargs shasum -a 256 > template-sums.txt
pnpm install
# The renderer's browser is a 140 MB download that a bad connection can break: one download per machine is enough.
browser="$HOME/.cache/article-figures/chrome-headless-shell"
if [ -f "$browser/VERSION" ]; then
  mkdir -p node_modules/.remotion
  cp -R "$browser" node_modules/.remotion/chrome-headless-shell
fi
echo "Ready: $target"
