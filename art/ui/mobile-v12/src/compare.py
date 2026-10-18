# 並排比較圖：上排 390×844、下排 375×667（1× 縮圖）
from PIL import Image, ImageDraw, ImageFont
import os
D = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cols = [('option-A', 'A 扇形手牌'), ('option-A-detail', 'A 點開：詳情底板'), ('option-A-burden-detail', 'A 點開：包袱'),
        ('prologue', '童年序章三選一'), ('skin-preview', '工程灰盒＋skin.css')]
rows = ['390x844', '375x667']
gap, top, lab = 24, 70, 34
W = gap + len(cols) * (390 + gap); H = top + lab + 844 + gap + lab + 667 + gap
im = Image.new('RGB', (W, H), '#D9DCD3'); d = ImageDraw.Draw(im)
f = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', 18, index=2)
ft = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc', 30, index=2)
d.text((gap, 18), 'v1.2 手機一屏版面：方案 A（製作人定案）（上：390×844　下：375×667）', font=ft, fill='#33302B')
y = top
for r in rows:
    w, h = map(int, r.split('x'))
    for i, (k, name) in enumerate(cols):
        x = gap + i * (390 + gap)
        d.text((x, y), f'{name}  {r.replace("x", "×")}', font=f, fill='#33302B')
        fn = os.path.join(D, f'{k}-{r}.png') if k != 'skin-preview' else os.path.join(D, f'skin-preview-{"A-turn" if r == "390x844" else "C"}-375x667.png')
        p = Image.open(fn).resize((w, h) if k != 'skin-preview' else (375, 667), Image.LANCZOS)
        if k == 'skin-preview': d.text((x, y + lab + 667 + 4), '（灰盒只有 375×667）', font=f, fill='#66615A')
        im.paste(p, (x, y + lab))
    y += lab + h + gap
im.save(os.path.join(D, 'compare.png'), optimize=True)
print(im.size)
