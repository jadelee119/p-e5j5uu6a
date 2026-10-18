"""手牌 7:5 裁切焦點：object-position 的 y 百分比（0＝貼頂、100＝貼底），x 一律 50%。輸出預覽 hand-crop-preview.png 並寫回 manifest。"""
import json
from PIL import Image, ImageDraw
F = {'teenjob':62,'loan':72,'single':45,'cram':40,'care':72,'filial':62,
     'shop':28,'newyear':46,'child':40,'track':46,'branch':62,'home':30}
m = json.load(open('manifest.json', encoding='utf-8'))
W, H = 600, 750; ch = round(W*5/7)
sheet = Image.new('RGB', (4*(W//2+16)+16, 3*(ch//2+16)+16), '#EEEDE8')
for i, (g, p) in enumerate(F.items()):
    im = Image.open(f'echo_{g}.png').convert('RGB')
    top = round((H-ch)*p/100)
    c = im.crop((0, top, W, top+ch)).resize((W//2, ch//2))
    sheet.paste(c, (16+(i%4)*(W//2+16), 16+(i//4)*(ch//2+16)))
    m['groups'][g]['hand_focus'] = f'50% {p}%'
m['_hand_focus_note'] = '手牌卡面框 7:5，用 object-fit: cover; object-position: <hand_focus>。詳情頁仍顯示整張 4:5。'
sheet.save('hand-crop-preview.png')
json.dump(m, open('manifest.json','w',encoding='utf-8'), ensure_ascii=False, indent=2)
