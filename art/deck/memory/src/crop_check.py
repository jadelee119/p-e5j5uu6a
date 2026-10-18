#!/usr/bin/env python3
"""裁切檢查：把 30 張用 object-fit: cover 裁成序章圖窗（84×150、72×124）和正方形（相簿），拼成 crop-check.png。開發用。"""
import os, json
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); D = os.path.abspath(os.path.join(HERE, '..'))
man = json.load(open(os.path.join(D, 'manifest.json'), encoding='utf-8'))
S = 1  # 1× ＝ 實際 CSS 尺寸
def cover(im, w, h):
    iw, ih = im.size; s = max(w / iw, h / ih); im = im.resize((round(iw * s), round(ih * s)), Image.LANCZOS)
    x = (im.width - w) // 2; y = (im.height - h) // 2; return im.crop((x, y, x + w, y + h))
boxes = [(84 * S, 150 * S), (72 * S, 124 * S), (120 * S, 120 * S)]
cw = sum(b[0] for b in boxes) + 4 * 8; ch = 150 * S + 16
ids = list(man['cards']); cols = 5; rows = (len(ids) + cols - 1) // cols
sheet = Image.new('RGB', (cols * cw, rows * ch), '#EDEFE8')
for i, cid in enumerate(ids):
    im = Image.open(os.path.join(D, cid + '.png')).convert('RGB')
    x0 = (i % cols) * cw + 8; y0 = (i // cols) * ch + 8
    for w, h in boxes:
        sheet.paste(cover(im, w, h), (x0, y0)); x0 += w + 8
sheet.quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(os.path.join(D, "crop-check.png"), optimize=True)
print('crop-check.png', sheet.size)
