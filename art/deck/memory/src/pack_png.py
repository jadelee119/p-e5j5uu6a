#!/usr/bin/env python3
"""把 render.mjs 匯出的 mem_*.png 壓成 96 色調色盤 PNG（不抖色），紙紋會讓全彩 PNG 很肥。"""
import os, glob
from PIL import Image
D = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
tot = 0
for f in sorted(glob.glob(os.path.join(D, 'mem_*.png')) + [os.path.join(D, 'contact-sheet.png')]):
    im = Image.open(f)
    if im.mode == 'P': tot += os.path.getsize(f); continue
    im.convert('RGB').quantize(colors=96, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(f, optimize=True)
    tot += os.path.getsize(f)
print('total KB', tot // 1024)
