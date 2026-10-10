#!/bin/bash
# usage: render.sh <CompositionId> <out.mp4>
cd "$(dirname "$0")/.."
npx remotion render src/index.ts "$1" "$2" \
  --browser-executable=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell \
  --gl=swangle --concurrency=4 --codec=h264 --crf=14 --pixel-format=yuv420p --muted --color-space=bt709 --log=error
