"""Line a LivePortrait loop up with the still it came from, then cut the frames for the TV. The owner saw the loop
"smaller than the thumbnail" (2026-11-27); that turned out to be the Chromecast mis-drawing libwebp's partial frames
(see webp.py), and this check found the loop's first frame already matches the still (scale 1.000). It stays as a
guard: match features on her head between the first frame and the still, fit a similarity transform, apply it to every
frame; then crop to her face, play 6 s forward and back, and write 192 px frames at 12 fps.
  python align.py <still.png> <liveportrait.mp4> <frames-out-dir>"""
import sys
from pathlib import Path
import cv2
import numpy as np

still_path, video_path, out_dir = sys.argv[1], sys.argv[2], Path(sys.argv[3])
out_dir.mkdir(parents=True, exist_ok=True)
still = cv2.imread(still_path)
cap = cv2.VideoCapture(video_path)
fps = cap.get(cv2.CAP_PROP_FPS) or 25
frames = []
while len(frames) < int(fps * 6):
    ok, f = cap.read()
    if not ok: break
    frames.append(f)

orb = cv2.ORB_create(4000)
g = lambda im: cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
# Only her head: LivePortrait pastes the body and background back untouched, so matching those finds "no change".
face_mask = np.zeros(still.shape[:2], np.uint8); cv2.ellipse(face_mask, (520, 390), (250, 290), 0, 0, 360, 255, -1)
k1, d1 = orb.detectAndCompute(g(frames[0]), face_mask)
k2, d2 = orb.detectAndCompute(g(still), face_mask)
matches = sorted(cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True).match(d1, d2), key=lambda m: m.distance)[:600]
src = np.float32([k1[m.queryIdx].pt for m in matches]); dst = np.float32([k2[m.trainIdx].pt for m in matches])
M, inliers = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=2.0)
scale = float(np.hypot(M[0, 0], M[0, 1]))
print(f'scale {scale:.3f} shift ({M[0, 2]:.1f}, {M[1, 2]:.1f}) inliers {int(inliers.sum())}/{len(matches)}')

h, w = still.shape[:2]
x0, y0, size = 102, 0, 820  # the same face crop as the still
seq = frames + frames[::-1]
step = fps / 12
for i, n in enumerate(np.arange(0, len(seq), step).astype(int)):
    f = cv2.warpAffine(seq[n], M, (w, h), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REPLICATE)
    face = cv2.resize(f[y0:y0 + size, x0:x0 + size], (192, 192), interpolation=cv2.INTER_AREA)
    cv2.imwrite(str(out_dir / f'f{i + 1:04d}.png'), face)
# how far the aligned first frame is from the still (mean absolute difference, 0-255)
first = cv2.warpAffine(frames[0], M, (w, h), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REPLICATE)
print('first-frame difference', round(float(np.abs(first.astype(int) - still.astype(int)).mean()), 2))
