#!/usr/bin/env python3
"""render_echo.mjs 之後跑：先從全彩 echo_*.png 輸出寬 480 的 WebP（品質 82），再把 PNG 壓成 128 色調色盤（不抖色；用 FASTOCTREE，記憶牌的 96 色 MEDIANCUT 會把小面積的黃色吃掉）；contact sheet 保留全彩（壓調色盤會讓色票跑掉，例如 cram 的青綠變成綠色）。"""
import os, glob
from PIL import Image
D = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
tot_p = tot_w = 0
for f in sorted(glob.glob(os.path.join(D, 'echo_*.png'))):
    im = Image.open(f)
    if im.mode != 'P':
        rgb = im.convert('RGB')
        rgb.resize((480, 600), Image.LANCZOS).save(f[:-4] + '.webp', 'WEBP', quality=82, method=6)
        rgb.quantize(colors=128, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(f, optimize=True)
    tot_p += os.path.getsize(f); tot_w += os.path.getsize(f[:-4] + '.webp')
print('png KB', tot_p // 1024, 'webp KB', tot_w // 1024)
