#!/usr/bin/env bash
# Salty's talking loops (owner's pick "B", 2026-11-27): LivePortrait animates each stage's picture from its sample
# driving clip d10.mp4; the first 6 s at 12 fps become a sheet of 72 face frames the TV plays forward then back.
# Writes <dst>/talk-s<stage>.jpg (the sheet) and the matching stills <dst>/s<stage>.jpg.
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
  # align.py: check it starts on the still, crop, 12 fps; then the first 72 frames (6 s) as one 9x8 sheet of 160 px
  # cells. The TV draws them on a canvas, forward then back (a <video> or animated WebP mis-draws on the Chromecast).
  "$PY" -I "$here/align.py" "$pics/$name.png" "$work/$name--d10.mp4" "$work/frames-s$s"
  ffmpeg -v error -y -start_number 1 -i "$work/frames-s$s/f%04d.png" -frames:v 72     -vf "scale=160:160:flags=lanczos,tile=9x8" -frames:v 1 -q:v 4 "$dst/talk-s$s.jpg"
  ffmpeg -v error -y -i "$pics/$name.png" -vf "crop=820:820:102:0,scale=256:256:flags=lanczos" -q:v 3 "$dst/s$s.jpg"
done
