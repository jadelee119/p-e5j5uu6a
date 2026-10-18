#!/usr/bin/env python3
"""把 render_era.mjs 匯出的 era_*.png 和 era-contact-sheet.png 壓成調色盤 PNG（紙紋會讓全彩 PNG 很肥）。"""
import os, glob
from PIL import Image
D = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
tot = 0
for f in sorted(glob.glob(os.path.join(D, 'era_*.png')) + [os.path.join(D, 'era-contact-sheet.png')]):
    im = Image.open(f)
    if im.mode != 'P':
        im.convert('RGB').quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(f, optimize=True)
    tot += os.path.getsize(f)
print('total KB', tot // 1024)
