#!/usr/bin/env bash
# Salty's talking loops (owner's pick "B", 2026-11-27): LivePortrait animates each stage's picture from its sample
# driving clip d10.mp4, then ffmpeg crops to her face, takes 6 s and plays it forward then backward (a seamless 12 s
# loop) as a 192 px, 12 fps animated WebP (a <video> on the Chromecast draws over everything, a black circle while
# it loads). Writes <dst>/talk-s<stage>.webp and the matching stills <dst>/s<stage>.jpg.
#   bash loops.sh <pictures-dir> <dst-dir>      (pictures: 3d-11.png, 3d-11-s2-r7.png, -s3-r7, -s4-r7 from gen/drunk.py)
# Setup (once): git clone https://github.com/KwaiVGI/LivePortrait ~/tools/LivePortrait; a Python 3.10 venv with
# torch 2.3.0+cu121, its requirements_base.txt (minus gradio), requests, and the CPU onnxruntime 1.18 (the GPU build on
# PyPI wants CUDA 11.8); weights: KwaiVGI/LivePortrait insightface/* and liveportrait/* into pretrained_weights/.
set -euo pipefail
pics=$1; dst=$2; work=$(mktemp -d); here=$(cd "$(dirname "$0")" && pwd)
LP=~/tools/LivePortrait; PY=~/venvs/liveportrait/Scripts/python.exe
for s in 1 2 3 4; do
  name=3d-11; [ "$s" != 1 ] && name=3d-11-s$s-r7
  (cd "$LP" && PYTHONIOENCODING=utf-8 "$PY" inference.py -s "$pics/$name.png" -d assets/examples/driving/d10.mp4 -o "$work")
  # align.py: crop, 6 s forward and back, 192 px at 12 fps; webp.py: every frame a keyframe (the Chromecast
  # mis-draws libwebp's partial frames as a shrunken face). Needs Pillow with WebP for webp.py.
  "$PY" -I "$here/align.py" "$pics/$name.png" "$work/$name--d10.mp4" "$work/frames-s$s"
  python -I "$here/webp.py" "$work/frames-s$s" "$dst/talk-s$s.webp"
  ffmpeg -v error -y -i "$pics/$name.png" -vf "crop=820:820:102:0,scale=256:256:flags=lanczos" -q:v 3 "$dst/s$s.jpg"
done
