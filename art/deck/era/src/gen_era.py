#!/usr/bin/env python3
"""時代牌十一張牌圖（美術設計）。輸出 art/deck/era/src/svg/<id>.svg（1280×720，放在 src/ 底下，免得引擎的 art/deck/era/* glob 抓到 svg）＋ manifest.json；PNG 由 render_era.mjs 匯出。
畫在 640×360 的座標裡再放大兩倍（線條粗細跟記憶牌一致）。tv-frame.svg 會疊在上面，主體放在螢幕安全區：
1280 座標 x 154–973、y 158–634（＝ 640 座標 x 77–486、y 79–317）。
規則：只畫日常生活；沒有災難現場、傷者、文字、數字、商標、真人、政治符號；臉一律空白。"""
import json, os, sys, math
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.abspath(os.path.join(HERE, '..'))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'memory', 'src'))
from gen_memory import (S, F, L, tube, circ, ell, rect, path, g, sparkle, note, motion, kid, tint, shade, mix,
                        INK, PAPER, SKIN, HAIR, RED, CREAM, WOOD, GREY)
W, H = 1280, 720
RAIN = '#9DB3C6'; MASK = '#CFE6F2'

def masked(x, y, s, shirt, pose='stand', **kw):
    """戴口罩的小孩／大人：kid() 再蓋一片口罩（頭在 (0,-150)，半徑 26）。"""
    m = rect(-22, -150, 44, 20, MASK, rx=7, sw=4) + L('M-22,-146 L-27,-156 M22,-146 L27,-156', sw=3)
    return kid(x, y, s, shirt, pose, **kw) + g(m, f'translate({x},{y}) scale({s})')

def rain(x0, y0, x1, y1, n=40, color=RAIN, seed=1, length=18):
    import random
    r = random.Random(seed); d = ''
    for _ in range(n):
        x = r.uniform(x0, x1); y = r.uniform(y0, y1); d += f'M{x:.0f},{y:.0f} l-5,{length} '
    return L(d, sw=3, color=color)

# ---------------------------------------------------------------- 十一張（640×360 座標）
def s_921(m):  # 雨天的鐵皮教室：大家擠在窗邊、教室裡的電風扇
    t = path('M96,150 L486,150 L486,300 L96,300 Z', '#EDE6D6', 6)
    t += path('M80,154 L502,154 L482,104 L100,104 Z', m, 6)
    t += L(' '.join(f'M{106+i*18},{106} L{88+i*18.9:.0f},{152}' for i in range(22)), sw=3, color=shade(m, .3))
    for i, x in enumerate((122, 236, 350)):
        t += rect(x, 178, 92, 72, '#CFE3EE', rx=3, sw=5)
        if i == 1:
            t += circ(x+46, 200, 16, '#F4F1EA', 4) + L(f'M{x+46},{184} L{x+46},{216} M{x+30},{200} L{x+62},{200}', sw=3, color=GREY) + L(f'M{x+46},216 L{x+46},236', sw=4)
        else:
            for j in range(3):
                hx = x + 18 + j*28
                t += circ(hx, 242, 11, SKIN, 3) + path(f'M{hx-11},{240} Q{hx},{226} {hx+11},{240} Z', HAIR, 0)
        t += L(f'M{x},{214} L{x+92},{214}', sw=3, color=GREY)
    t += rect(452, 200, 26, 100, tint(m, .4), rx=2, sw=5)
    for i in range(6): t += L(f'M{120+i*70},158 l0,{10+(i%2)*6}', sw=3, color=RAIN)
    t += L('M250,92 q6,-8 0,-16 M270,90 q8,-10 0,-22 M330,92 q6,-8 0,-16', sw=4, color=shade(m, .1))
    t += rain(70, 40, 520, 300, 70, seed=3)
    t += path('M70,300 L510,300 L520,330 L60,330 Z', '#B9B2A4', 0)
    t += ell(170, 316, 46, 7, RAIN, 0) + ell(400, 318, 60, 8, RAIN, 0)
    return t

def s_nari(m):  # 從家裡的窗戶看樓下的路變成河；窗台上一雙雨鞋
    t = rect(110, 70, 340, 224, '#DCE6EC', rx=4, sw=0)
    t += path('M110,70 L450,70 L450,130 L110,130 Z', '#C7D3DB', 0)
    for x in (130, 220, 330, 400): t += rect(x, 92, 50, 60, '#B4C1CA', rx=2, sw=3)
    t += path('M110,170 Q200,160 280,172 T450,168 L450,294 L110,294 Z', tint(m, .25), 0)
    t += L('M130,200 q20,-8 40,0 t40,0 M260,230 q20,-8 40,0 t40,0 M160,262 q20,-8 40,0 t40,0 M340,270 q20,-8 40,0', sw=4, color=PAPER)
    t += path('M300,186 Q300,170 320,168 L380,168 Q398,170 400,186 Z', '#E9A04A', 5)
    t += tube('M180,184 L180,110', GREY, 6) + circ(180, 104, 10, '#FFF3B0', 4)
    t += rain(110, 70, 450, 290, 50, seed=5, color='#FFFFFF')
    t += path('M96,58 L464,58 L464,306 L96,306 Z M110,70 L450,70 L450,294 L110,294 Z', '#F2EDE3', 6).replace('<path', '<path fill-rule="evenodd"')
    t += L('M280,70 L280,294 M110,182 L450,182', sw=7, color='#F2EDE3') + L('M280,70 L280,294 M110,182 L450,182', sw=3)
    t += rect(84, 300, 392, 18, WOOD, rx=3, sw=5)
    t += kid(208, 352, .8, tint(m, .1), 'stand', back=True)
    for x in (400, 432):
        t += path(f'M{x},{262} L{x+22},{262} L{x+22},{306} L{x+34},{310} L{x+34},{320} L{x-2},{320} Z', '#F2C94C', 5)
    return t

def s_sars(m):  # 早上的桌上：聯絡簿、體溫計、口罩
    t = path('M150,96 L290,108 L428,94 L436,300 L290,314 L144,300 Z', m, 6)
    t += path('M162,106 L288,120 L288,300 L158,288 Z', PAPER) + path('M292,120 L418,104 L424,290 L292,300 Z', PAPER)
    for i in range(6):
        y = 144 + i*26
        t += L(f'M176,{y-4} l94,6', sw=3, color=GREY) + L(f'M308,{y+2} l96,-8', sw=3, color=GREY)
    t += rect(318, 240, 60, 30, 'none', rx=3, sw=4, rot=-4)
    t += L('M324,258 c6,-12 12,6 18,-4 s8,10 16,-2', sw=4, color=shade(m, .2))
    t += g(rect(-90, -6, 170, 12, '#F7F7F7', rx=6, sw=4) + circ(86, 0, 11, RED, 4) + L('M-80,0 L60,0', sw=3, color=tint(RED, .3)),
           'translate(260,236) rotate(-18)')
    t += g(rect(-52, -30, 104, 60, MASK, rx=12, sw=5) + L('M-46,-12 L46,-12 M-46,4 L46,4 M-46,18 L46,18', sw=3, color='#9CC3D6') +
           L('M-52,-20 C-80,-24 -80,24 -52,20 M52,-20 C80,-24 80,24 52,20', sw=4), 'translate(440,232) rotate(10)')
    t += g(rect(0, -7, 90, 14, '#E9B949', rx=3, sw=4) + path('M90,-7 L108,0 L90,7 Z', '#F1D9A8', 4), 'translate(120,300) rotate(-24)')
    t += circ(470, 120, 24, '#F7D774', 5) + L('M470,84 l0,-10 M506,120 l10,0 M496,94 l8,-8', sw=4, color='#E9B949')
    return t

def s_hsr(m):  # 窗外劃過去的新列車（虛構：灰綠車身、兩條細深青線、圓圓的玩具車頭；車上沒有主色橘）
    TEAL = '#2E6E6A'; BODY = '#D3E2D4'
    t = path('M60,70 L520,70 L520,330 L60,330 Z', '#F6D2A8', 0)
    t += path('M60,70 L520,70 L520,104 L60,112 Z', '#F2B98A', 0)
    t += circ(400, 150, 30, tint(m, .1), 0)
    t += path('M60,160 Q140,116 220,150 T380,138 T520,150 L520,200 L60,200 Z', '#9DB79A', 0)
    for i in range(5): t += path(f'M60,{230+i*22} L520,{224+i*22} L520,{238+i*22} L60,{244+i*22} Z', '#8DBB6A' if i % 2 else '#A6CF7E', 0)
    t += rect(60, 200, 460, 12, '#CFC8BC', rx=2, sw=4)
    for x in (110, 210, 310, 410, 500): t += rect(x - 8, 212, 16, 28, '#CFC8BC', rx=2, sw=4)
    train = (path('M150,198 L430,198 L430,146 L176,146 C140,146 118,170 118,186 Q118,198 150,198 Z', BODY, 6) +
             path('M140,154 C150,150 160,148 172,148 L170,170 L128,170 C130,162 134,158 140,154 Z', '#4A5A62', 4) +
             ''.join(rect(196 + i*38, 154, 24, 16, '#4A5A62', rx=7, sw=0) for i in range(6)) +
             L('M124,176 L430,176', sw=2.5, color=TEAL) + L('M122,181 L430,181', sw=2.5, color=TEAL) +
             circ(128, 190, 4, '#FFF3B0', 3) +
             L('M276,146 L276,198 M354,146 L354,198', sw=3, color=GREY) +
             ''.join(circ(170 + i*70, 199, 6, '#6B6B66', 3) for i in range(4)))
    t += train + motion(446, 158, 3, 46, 14, GREY) + L('M100,178 l-36,0 M104,194 l-30,0', sw=4, color=GREY)
    t += path('M40,50 L540,50 L540,350 L40,350 Z M60,70 L520,70 L520,330 L60,330 Z', '#F2EDE3', 6).replace('<path', '<path fill-rule="evenodd"')
    t += kid(150, 380, .82, m, 'stand', back=True)
    t += rect(40, 320, 500, 16, WOOD, rx=3, sw=5)
    return t

def s_crisis(m):  # 飯桌上攤開的帳單，大人托著頭；吊燈
    t = L('M290,40 L290,82', sw=4) + path('M256,82 L324,82 L338,104 L242,104 Z', tint(m, .3), 5)
    t += path('M248,104 L332,104 L420,300 L160,300 Z', '#FFF3B0', 0).replace('filter', 'opacity=".35" filter')
    t += rect(420, 96, 70, 54, '#3A3A36', rx=6, sw=5) + rect(428, 104, 54, 38, tint(m, .5), rx=4, sw=0) + L('M432,112 l12,10 l10,-4 l12,14 l12,6', sw=3, color=PAPER)
    t += kid(290, 300, 1.0, tint(m, .25), 'hold')
    t += path('M100,236 L480,236 L500,262 L80,262 Z', WOOD, 6) + L('M110,262 L104,330 M470,262 L476,330', sw=9, color=WOOD) + L('M110,262 L104,330 M470,262 L476,330', sw=3)
    for (x, y, r) in ((176, 240, -8), (212, 236, 6), (370, 238, -4)):
        t += g(rect(-28, -10, 56, 30, '#FFFFFF', rx=2, sw=4) + L('M-20,-2 l40,0 M-20,6 l30,0', sw=2.5, color=GREY), f'translate({x},{y}) scale(1,.6) rotate({r})')
    t += g(rect(-18, -12, 36, 24, '#D9D3C4', rx=3, sw=4) + ''.join(rect(-12 + c*9, -4 + r*7, 6, 4, GREY, rx=1, sw=0) for c in range(3) for r in range(2)), 'translate(420,236) scale(1,.7)')
    t += path('M130,216 L154,216 L150,240 L134,240 Z', '#FFFFFF', 4) + L('M138,206 q-6,-8 0,-16 M148,206 q6,-8 0,-16', sw=3, color=GREY)
    return t

def s_voucher(m):  # 迴紋針夾著的一疊券、印章和印泥、米和球鞋
    t = path('M70,250 L510,240 L520,330 L60,330 Z', WOOD, 0)
    cols = ['#F2B8C6', '#BFE0B0', '#F7DE8C', '#B9D4EE', '#F2C29A']
    for i, c in enumerate(cols):
        t += g(rect(-90, -46, 180, 92, c, rx=6, sw=5) + rect(-78, -34, 156, 68, 'none', rx=4, sw=3) +
               circ(-44, 0, 18, tint(c, -0.0) if False else shade(c, .15), 3) + L('M-10,-14 l70,0 M-10,0 l60,0 M-10,14 l70,0', sw=3, color=shade(c, .35)),
               f'translate({270 + i*6},{220 - i*12}) rotate({-8 + i*4})')
    t += L('M224,150 L224,124 Q224,114 234,114 Q244,114 244,124 L244,160 Q244,168 236,168 Q228,168 228,160 L228,130', sw=5, color=GREY)
    t += path('M160,236 L182,236 L184,300 L158,300 Z', '#C79A63', 5) + circ(171, 230, 13, '#C79A63', 5) + ell(171, 300, 13, 4, RED, 4)
    t += ell(110, 300, 30, 10, '#B9B2A4', 5) + ell(110, 296, 24, 7, RED, 0)
    t += path('M400,300 L394,236 Q396,212 420,206 L414,190 L470,190 L464,206 Q488,212 490,236 L484,300 Z', '#EFE6D2', 6) + L('M418,204 L466,204', sw=5) + L('M430,190 l-6,-12 M454,190 l6,-12', sw=4)
    t += L('M416,250 l52,0 M412,268 l60,0', sw=3, color=GREY) + circ(442, 230, 9, m, 3)
    t += g(path('M-50,10 L-46,-14 Q-40,-26 -20,-24 L0,-10 L36,-4 Q54,0 52,12 Z', '#FFFFFF', 5) + rect(-54, 10, 110, 10, m, rx=5, sw=4), 'translate(346,312)')
    return t

def s_morakot(m):  # 停水那幾天：一盆水洗完臉留著沖馬桶，窗外的雨停不下來
    t = rect(330, 70, 160, 130, '#C9D6E2', rx=4, sw=0) + path('M330,150 Q400,130 490,150 L490,200 L330,200 Z', '#9FB49A', 0)
    t += rain(330, 70, 490, 200, 40, seed=7, color='#FFFFFF')
    t += path('M318,58 L502,58 L502,212 L318,212 Z M330,70 L490,70 L490,200 L330,200 Z', '#F2EDE3', 6).replace('<path', '<path fill-rule="evenodd"') + L('M410,70 L410,200', sw=5)
    t += rect(90, 70, 210, 170, '#E9EEF0', rx=0, sw=0)
    for r in range(4):
        for c in range(6): t += rect(90 + c*35, 70 + r*42, 35, 42, 'none', rx=0, sw=2).replace(INK, '#C8CFD2')
    t += path('M60,240 L520,240 L520,330 L60,330 Z', '#D8D4CA', 0)
    t += path('M150,230 L350,230 L330,300 Q250,316 170,300 Z', RED, 6)
    t += ell(250, 230, 100, 18, tint('#6FA8C8', .2), 6)
    t += L('M200,232 q16,-6 32,0 M260,228 q16,-6 32,0', sw=3, color=PAPER)
    t += g(ell(0, 0, 34, 12, '#F2C94C', 5) + L('M30,-4 L84,-24', sw=8, color='#F2C94C') + L('M30,-4 L84,-24', sw=3), 'translate(220,226) rotate(-6)')
    t += path('M316,226 L340,226 L346,296 L322,300 Z', tint(m, .5), 5) + L('M318,240 l24,0', sw=3, color=PAPER)
    t += path('M400,250 L470,250 L462,316 L408,316 Z', tint(m, .15), 6) + ell(435, 250, 35, 8, '#7FB0D2', 5) + L('M406,250 Q435,214 464,250', sw=4)
    t += circ(140, 262, 4, '#7FB0D2', 0) + circ(360, 270, 3, '#7FB0D2', 0)
    return t

def s_sunflower(m):  # 晚餐時電視一直開著：抽象的人群畫面，大家邊吃邊聊（中立，沒有標語、旗子、建築）
    t = rect(330, 210, 170, 70, WOOD, rx=4) + L('M350,280 L350,300 M480,280 L480,300', sw=6)
    t += rect(340, 100, 150, 112, '#3A3A36', rx=14, sw=6) + rect(352, 112, 112, 84, tint(m, .55), rx=10, sw=0)
    heads = ''
    cols = ['#5A5048', '#7A6A5A', '#8C7B6B', '#4A4440', '#6B5E52']
    for r in range(3):
        for c in range(7):
            heads += circ(362 + c*16 + (r % 2)*8, 140 + r*14, 6, cols[(r*7+c) % 5], 0)
    t += heads + rect(352, 180, 112, 14, '#F2EDE3', rx=0, sw=0) + rect(352, 180, 26, 14, m, rx=0, sw=0)
    t += circ(476, 130, 6, INK, 0) + circ(476, 152, 6, INK, 0) + L('M400,100 L380,70 M420,100 L444,72', sw=4)
    t += rect(352, 112, 112, 84, 'none', rx=10, sw=4)
    t += path('M70,250 L320,250 L330,272 L60,272 Z', '#E9E1CF', 6) + L('M80,272 L76,330 M310,272 L314,330', sw=8, color=WOOD)
    for x in (120, 200, 268):
        t += path(f'M{x-18},{240} Q{x},{262} {x+18},{240} Z', '#FFFFFF', 4) + L(f'M{x+10},{236} l18,-14', sw=3)
    t += ell(200, 244, 26, 6, '#E9A04A', 0)
    t += kid(110, 352, .78, tint(m, .2), 'hold', back=True) + kid(200, 352, .62, '#E9A04A', 'hold', back=True) + kid(278, 352, .8, '#6B8C6A', 'hold', back=True)
    t += L('M232,190 q10,-10 0,-20 M246,196 q14,-16 0,-32', sw=3, color=GREY)
    return t

def s_flexday(m):  # 新的排班表：牆上沒有數字的月曆，兩種顏色的休假格；打工的人靠著牆
    t = rect(96, 80, 250, 216, '#FFFDF4', rx=4)
    t += rect(96, 80, 250, 34, m, rx=4, sw=5)
    for r in range(5):
        for c in range(7):
            x = 106 + c*33; y = 124 + r*33
            col = None
            if c == 5: col = tint('#E9A04A', .35)
            if c == 6: col = tint(m, .35)
            t += rect(x, y, 28, 28, col or 'none', rx=3, sw=3)
    t += circ(221, 84, 8, '#E9B949', 4)
    t += g(rect(-40, -54, 80, 108, '#FFFFFF', rx=3, sw=4) + ''.join(L(f'M-28,{-36+i*16} l56,0', sw=3, color=GREY) for i in range(6)) + rect(-28, 34, 20, 10, m, rx=2, sw=0), 'translate(400,150) rotate(6)')
    t += circ(400, 98, 7, RED, 3)
    worker = kid(0, 0, 1.0, '#E9E1CF', 'hold') + g(path('M-26,-112 L26,-112 L32,-50 L-32,-50 Z', m, 5), 'translate(0,0)')
    t += g(worker, 'translate(420,330) rotate(-6)')
    t += path('M430,214 L446,214 L444,236 L432,236 Z', '#FFFFFF', 4)
    t += L('M380,178 q-4,-8 4,-12 M392,170 q-4,-8 4,-12', sw=3, color=GREY).replace('stroke="#8E8A82"', 'stroke="#8E8A82" opacity="0"')
    t += path('M60,320 L520,320 L520,340 L60,340 Z', '#CFC8BC', 0)
    return t

def s_covid(m):  # 藥局門口排隊，前面的人拿著健保卡（卡面沒有字）
    t = rect(240, 96, 260, 210, '#F4F1EA', rx=4)
    t += path('M228,96 L512,96 L520,136 L220,136 Z', m, 6)
    t += g(circ(470, 76, 22, '#FFFFFF', 5) + path('M464,62 L476,62 L476,70 L484,70 L484,82 L476,82 L476,90 L464,90 L464,82 L456,82 L456,70 L464,70 Z', '#3AA06A', 3), 'translate(-96,40)')
    t += rect(262, 150, 130, 100, '#D7ECE9', rx=4, sw=5) + rect(410, 160, 70, 146, tint(m, .5), rx=3, sw=5)
    for i in range(3): t += rect(272 + i*40, 222, 30, 26, ['#F2B8C6', '#F7DE8C', '#BFE0B0'][i], rx=3, sw=3)
    t += path('M60,306 L520,306 L520,330 L60,330 Z', '#CFC8BC', 0)
    q = [(380, .82, '#E07A5F', 'hold'), (304, .9, '#5A7DB5', 'stand'), (232, .66, '#F2C94C', 'stand'), (160, .92, '#7A6A5A', 'stand'), (96, .7, '#8A4FA0', 'stand')]
    for x, s, c, p in q[::-1]:
        t += masked(x, 324, s, c, p)
    t += g(rect(-16, -10, 32, 20, '#BFE0B0', rx=3, sw=4) + rect(-12, -6, 10, 12, '#FFFFFF', rx=1, sw=0), 'translate(380,256) rotate(-8)')
    t += L('M250,320 l14,0 M318,322 l14,0 M178,322 l14,0', sw=3, color=GREY)
    return t

def s_covid_lv3(m):  # 畢業典禮取消：學士服套在家居服外面，對著筆電鏡頭拍一張
    t = rect(170, 60, 240, 150, '#DDE9F0', rx=4, sw=5)
    t += path('M150,50 L230,50 C214,120 230,200 200,250 L150,250 Z', m, 6) + path('M430,50 L350,50 C366,120 350,200 380,250 L430,250 Z', m, 6)
    t += L('M140,50 L440,50', sw=8)
    t += path('M120,250 L460,250 L460,330 L120,330 Z', '#E9E1CF', 0)
    leg = L('M-12,-62 L-16,0 M12,-62 L16,0', sw=16, color='#F2B8C6') + L('M-22,-40 l14,0 M8,-40 l14,0 M-22,-22 l14,0 M8,-22 l14,0', sw=3, color=shade('#F2B8C6', .3))
    gown = path('M-34,-124 Q0,-136 34,-124 L50,-50 L-50,-50 Z', '#2E2B33', 6) + path('M-14,-128 L0,-104 L14,-128 Z', tint(m, .3), 3)
    arms = L('M-30,-118 L-56,-140 L-60,-170 M30,-118 L56,-140 L62,-172', sw=12, color='#2E2B33')
    head = circ(0, -150, 26, SKIN, 6) + path('M-27,-152 Q-24,-182 2,-178 Q26,-178 27,-154 Q8,-166 -27,-152 Z', HAIR, 0)
    cap = path('M-44,-178 L0,-194 L44,-178 L0,-162 Z', '#2E2B33', 5) + path('M-18,-172 L-18,-160 Q0,-152 18,-160 L18,-172 Z', '#2E2B33', 4) + L('M30,-180 L40,-150', sw=3, color='#F2C94C') + circ(40, -148, 4, '#F2C94C', 0)
    feet = ell(-18, 2, 14, 6, tint(m, .4), 4) + ell(18, 2, 14, 6, tint(m, .4), 4)
    t += g(leg + feet + gown + arms + head + cap, 'translate(320,300) scale(.95)')
    t += path('M70,262 L250,262 L262,284 L58,284 Z', WOOD, 6) + L('M72,284 L70,330 M246,284 L250,330', sw=8, color=WOOD)
    t += path('M96,262 L196,262 L210,276 L84,276 Z', '#BDB8AE', 5)
    t += g(rect(-52, -70, 104, 68, '#3A3A36', rx=6, sw=5) + rect(-46, -64, 92, 56, '#EEF2F4', rx=3, sw=0) +
           ''.join(circ(-30 + c*30, -50 + r*24, 9, ['#F2B8C6', '#BFE0B0', '#F7DE8C', '#B9D4EE', tint(m, .3), '#E9A04A'][r*3+c], 0) for r in range(2) for c in range(3)) +
           circ(0, -66, 2.5, '#9BE07A', 0), 'translate(144,264) rotate(4)')
    return t

CARDS = [
    ('era_921',       '#8C4A32', s_921,       -1.2, '下雨天的鐵皮屋頂臨時教室：窗裡擠著小孩、教室裡一台電風扇、屋頂上的雨聲'),
    ('era_nari',      '#2F6F8F', s_nari,       1.0, '從家裡的窗戶看出去，樓下的路變成河（只露出車頂和路燈）；窗邊的小孩背影、一雙黃雨鞋'),
    ('era_sars',      '#5E8F4A', s_sars,      -1.0, '早上的書桌：攤開的聯絡簿和簽名、體溫計、一片口罩、窗外的太陽'),
    ('era_hsr',       '#D9732B', s_hsr,        1.2, '黃昏時窗外高架橋上劃過去的新列車（完全虛構：淺灰綠車身、窗下兩條細深青線、圓圓的玩具車頭，車上沒有橘色、沒有標誌），橘色只用在夕陽天空和窗前小孩的上衣；稻田'),
    ('era_crisis',    '#5A5F73', s_crisis,    -1.0, '吊燈下的飯桌：大人托著頭、攤開的帳單、沒有數字的計算機、一杯茶；角落的小電視停在一條曲線'),
    ('era_voucher',   '#C99A1E', s_voucher,    1.0, '迴紋針夾著的一疊像大富翁的彩色券、木頭印章和紅印泥、一袋米和一隻球鞋'),
    ('era_morakot',   '#6B5E3A', s_morakot,   -1.0, '停水那幾天的浴室：紅色臉盆裡留著的水、水瓢、毛巾、一桶備用水；窗外的雨停不下來'),
    ('era_sunflower', '#7A6A9A', s_sunflower,  1.0, '晚餐時電視一直開著：螢幕上是抽象的人群（只有圓點，沒有標語、旗子、建築），一家人的背影邊吃邊聊'),
    ('era_flexday',   '#3C5BA9', s_flexday,   -1.2, '員工休息區：牆上沒有數字的月曆，每週有兩種顏色的休假格；新貼的排班表；穿圍裙的打工族拿著杯子靠牆'),
    ('era_covid',     '#3FA0B5', s_covid,      1.0, '藥局門口戴口罩排隊的一列人，最前面的人拿著健保卡（卡面沒有字）；藥局只用通用的十字'),
    ('era_covid_lv3', '#A0457A', s_covid_lv3, -1.0, '房間窗簾前，學士服套在粉紅條紋睡褲外面、戴著方帽舉起雙手；桌上筆電的視訊格都是同學的彩色大頭貼'),
]

DEFS = '''<defs>
 <filter id="wl" filterUnits="userSpaceOnUse" x="-2000" y="-2000" width="5000" height="5000"><feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="2" seed="{s1}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G"/></filter>
 <filter id="wf" filterUnits="userSpaceOnUse" x="-2000" y="-2000" width="5000" height="5000"><feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="{s2}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="8" xChannelSelector="G" yChannelSelector="R"/><feTranslate dx="2" dy="1.5"/></filter>
 <filter id="blob" filterUnits="userSpaceOnUse" x="0" y="0" width="1280" height="720"><feTurbulence type="fractalNoise" baseFrequency="0.008" numOctaves="3" seed="{s3}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="60" xChannelSelector="R" yChannelSelector="G"/></filter>
 <filter id="grain" filterUnits="userSpaceOnUse" x="0" y="0" width="1280" height="720"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3" seed="{s4}"/><feColorMatrix values="0 0 0 0 .2  0 0 0 0 .19  0 0 0 0 .17  0 0 0 .12 0"/></filter>
 <filter id="crayon" filterUnits="userSpaceOnUse" x="0" y="0" width="1280" height="720"><feTurbulence type="fractalNoise" baseFrequency=".35 .04" numOctaves="2" seed="{s5}" result="t"/><feColorMatrix in="t" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -1.6 1.15" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter>
</defs>'''

def card_svg(cid, main, fn, tilt, seed):
    bg = (f'<rect width="{W}" height="{H}" fill="{tint(main, .82)}"/>'
          f'<g filter="url(#crayon)"><g filter="url(#blob)"><rect x="90" y="96" width="960" height="590" rx="120" fill="{tint(main, .6)}" transform="rotate({-tilt} 563 396)"/></g></g>')
    body = f'<g transform="rotate({tilt} 563 396) translate(0,0) scale(2)">{fn(main)}</g>'
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">'
           f'<!-- 《台灣人生》時代牌牌圖 {cid}｜主色 {main}｜art/deck/era/src/gen_era.py 產生，請改產生器不要手改 -->'
           + DEFS.format(s1=seed, s2=seed + 7, s3=seed + 13, s4=seed + 21, s5=seed + 29) + bg + body +
           f'<rect width="{W}" height="{H}" filter="url(#grain)"/></svg>')
    assert '<text' not in svg, cid
    return svg

def main():
    data = os.path.join(HERE, '..', '..', '..', '..', 'data', 'deck', 'era_cards.json')
    if os.path.exists(data):
        ids = [c['id'] for c in json.load(open(data, encoding='utf-8'))['cards']]
        if sorted(ids) != sorted(c[0] for c in CARDS):
            print('⚠️ era_cards.json 的 id 跟產生器不一致：', set(ids) ^ {c[0] for c in CARDS}); sys.exit(1)
    man = {'_note': '時代牌牌圖（美術設計）。1280×720，engine 讀 png；tv-frame.svg 疊在上面，主體在螢幕安全區 x 12–76%、y 22–88%。accent＝定案主色（製作人已交給工程，填進 era_cards.json 的 accent），同時拿來染電視框 --acc。',
           'size': [W, H], 'safe_zone_pct': [12, 22, 76, 88], 'frame': 'art/deck/era/tv-frame.svg', 'cards': {}}
    for i, (cid, main_c, fn, tilt, subj) in enumerate(CARDS):
        os.makedirs(os.path.join(HERE, 'svg'), exist_ok=True); open(os.path.join(HERE, 'svg', cid + '.svg'), 'w', encoding='utf-8').write(card_svg(cid, main_c, fn, tilt, 41 + i * 5))
        man['cards'][cid] = {'png': f'art/deck/era/{cid}.png', 'svg': f'art/deck/era/src/svg/{cid}.svg', 'accent': main_c, 'subject': subj}
    json.dump(man, open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('wrote', len(CARDS))

if __name__ == '__main__':
    main()
