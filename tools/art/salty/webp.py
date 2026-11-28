"""Animated WebP with every frame a full keyframe (the Chromecast mis-draws libwebp's partial frames as it starts).
  python webp.py <frames-dir> <out.webp>   (frames: f0001.png ... at 12 fps)"""
import sys
from pathlib import Path
from PIL import Image
frames = [Image.open(p).convert('RGB') for p in sorted(Path(sys.argv[1]).glob('f*.png'))]
frames[0].save(sys.argv[2], save_all=True, append_images=frames[1:], duration=83, loop=0, quality=60, method=6,
               minimize_size=False, kmin=0, kmax=1, allow_mixed=False)
print(sys.argv[2], len(frames), 'frames')
