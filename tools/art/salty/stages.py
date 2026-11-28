"""Salty's 12 frames (4 stages x closed/mid/open). Each talking frame is spliced onto its stage's own picture where the
mouth changed (lower face only), so old and new lips never mix and her eyes and hair hold still. Face crops for the TV."""
import sys
import numpy as np
from pathlib import Path
from PIL import Image, ImageFilter
out, dst = Path(sys.argv[1]), Path(sys.argv[2])
CROP = (102, 0, 922, 820)
BASES = {1: '3d-11', 2: '3d-11-s2-r7', 3: '3d-11-s3-r7', 4: '3d-11-s4-r7'}  # round 2 picks


def mouth_mask(base, frame):
    d = np.abs(np.asarray(frame, dtype=np.int16) - np.asarray(base, dtype=np.int16)).sum(axis=2)
    roi = np.zeros_like(d, dtype=bool); roi[585:, 330:730] = True  # below the nose, down through the neck: the jaw drops when she talks
    m = Image.fromarray(((d > 60) & roi).astype(np.uint8) * 255)
    m = m.filter(ImageFilter.MaxFilter(21)).filter(ImageFilter.MaxFilter(21))  # close the gaps inside the lips
    return m.filter(ImageFilter.GaussianBlur(7))


for stage, name in BASES.items():
    base = Image.open(out / f'{name}.png').convert('RGB')
    for key in ('closed', 'mid', 'open'):
        if key == 'closed': im = base
        else:
            f = Image.open(out / f'{name}-{key}.png').convert('RGB')
            im = Image.composite(f, base, mouth_mask(base, f))
        im.crop(CROP).resize((256, 256), Image.LANCZOS).save(dst / f's{stage}-{key}.jpg', quality=88)
print('ok')
