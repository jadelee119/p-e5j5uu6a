#!/usr/bin/env python3
"""回音牌插圖產生器（美術設計）。
輸出：art/deck/echo/src/echo_<組名>.svg（4:5 母版 480×600）＋ art/deck/echo/manifest.json。
PNG（600×750）、WebP（寬 480）由 render_echo.mjs ＋ pack_echo.py 匯出。
筆觸、紙紋、濾鏡、色彩工具直接沿用童年記憶牌的 art/deck/memory/src/gen_memory.py（import 它的 helper），風格才會一致。
每組一張，苦版和暖版共用：畫面是中性的日常場景，主物件明確。
規則：圖裡不放任何文字、字母、數字；人物臉一律空白；沒有商標。"""
import json, os, sys, math
sys.dont_write_bytecode = True  # 不在 memory/src 留 __pycache__

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, '..'))
ROOT = os.path.abspath(os.path.join(OUT, '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'art', 'deck', 'memory', 'src'))
from gen_memory import (W, H, INK, PAPER, SKIN, HAIR, RED, CREAM, WOOD, GREY, SW, DEFS,
                        mix, tint, shade, S, F, L, tube, circ, ell, rect, path, g,
                        sparkle, note, motion, kid)

def wavy(x, y, w, sw=4, color=GREY, amp=4):
    """一行假字：波浪線（不是字）。"""
    n = max(1, int(w // 24)); d = f'M{x},{y}'
    for i in range(n): d += f' q6,{-amp} 12,0 t12,0'
    return L(d, sw=sw, color=color)

def scooter(x, y, s, body):
    t = circ(-36, 0, 17, '#4B4640', 6) + circ(40, 0, 17, '#4B4640', 6)
    t += path('M-56,-12 Q-56,-44 -22,-44 L8,-44 Q20,-44 24,-60 L34,-84 L44,-84 L56,-12 Q20,-2 -56,-12 Z', body, 6)
    t += rect(-50, -58, 52, 14, '#3B3330', rx=7, sw=5)
    t += L('M38,-84 L30,-104 M18,-104 L44,-104', sw=6)
    return g(t, f'translate({x},{y}) scale({s})')

def hand(x, y, rot, sleeve, skin=SKIN, s=1.0, old=False):
    """袖子＋手掌（沒有細節的手）。(x,y) 是手掌中心，往 +x 方向伸出去。"""
    t = path('M-170,-30 L-40,-28 L-40,30 L-170,32 Z', sleeve, 6)
    t += path('M-44,-24 Q10,-34 40,-14 Q52,-2 40,8 L10,10 Q0,28 -44,24 Z', skin, 6)
    t += L('M-6,-22 L34,-12 M-6,-8 L38,0', sw=3, color=shade(skin, .3))
    if old: t += L('M-30,-6 q6,-4 12,0 M-30,6 q6,-4 12,0', sw=3, color=shade(skin, .35))
    return g(t, f'translate({x},{y}) rotate({rot}) scale({s})')

def soft(el_svg, op):
    return el_svg.replace('filter="url(#wf)"', f'filter="url(#wf)" opacity="{op}"')

# ------------------------------------------------------------------ v1.2 新的 8 組
def c_teenjob(m):  # 打工店：牆上的圍裙＋空白名牌、封口機、封好的杯子
    t = circ(160, 104, 9, GREY, 5)
    t += L('M126,196 Q160,96 194,196', sw=8, color=shade(m, .3))
    t += path('M120,190 L200,190 L206,266 L114,266 Z', m)
    t += L('M110,266 q-30,12 -34,46 M210,266 q30,14 30,48', sw=7, color=shade(m, .15))
    t += path('M104,260 L216,260 L234,432 Q160,450 86,432 Z', m)
    t += path('M122,334 L198,334 L196,390 L124,390 Z', tint(m, .35), 6)
    t += g(rect(-5, -34, 10, 54, '#3A6FB0', rx=3, sw=4) + rect(-6, -40, 12, 10, INK, rx=2, sw=0), 'translate(182,336) rotate(10)')
    t += rect(134, 208, 54, 26, '#FFFFFF', rx=5, sw=5)  # 名牌：空白
    t += L('M60,478 L430,470', sw=7)
    t += rect(262, 304, 128, 166, '#ECE9E1', rx=14)
    t += rect(250, 252, 152, 60, '#D6D2C8', rx=16)
    t += tube('M386,268 L428,206', GREY, 10) + circ(430, 200, 15, m, 6)
    t += rect(284, 344, 84, 98, '#5A5550', rx=10)
    t += path('M302,360 L350,360 L345,436 L307,436 Z', '#E7C79A', 5) + ell(326, 360, 26, 6, '#FBF7EE', 4)
    t += motion(404, 300, 3, 26, 14, m, -30)
    cup = (path('M-30,-56 L30,-56 L22,48 L-22,48 Z', '#DDB98C', 6) + ell(0, -56, 31, 8, '#FBF7EE', 5) +
           ''.join(circ(dx, 36, 6, '#4A3326', 0) for dx in (-12, 0, 12)) + circ(-6, 24, 6, '#4A3326', 0) + circ(8, 24, 6, '#4A3326', 0))
    t += g(cup, 'translate(222,470) rotate(-6)')
    t += g(rect(0, -6, 120, 12, '#FFFFFF', rx=6, sw=5) + L('M20,-6 l10,12 M50,-6 l10,12 M80,-6 l10,12', sw=4, color=m), 'translate(90,520) rotate(-10)')
    t += sparkle(300, 214, 10, m) + sparkle(110, 470, 8, m)
    return t

def c_loan(m):  # 銀行櫃檯：玻璃隔板、一疊文件、印章、印泥、鍊條筆
    t = rect(64, 84, 352, 250, shade(m, .1), rx=10)
    for x in (84, 250):
        t += rect(x, 104, 146, 196, '#E9F5EC', rx=6, sw=6)
        t += L(f'M{x+20},{124+70} l46,-64 M{x+40},{124+90} l56,-78', sw=6, color='#FFFFFF')
    t += path('M196,300 Q240,262 284,300 Z', shade(m, .35), 5)
    t += path('M36,330 L444,330 L462,470 L18,470 Z', '#D8B88A', SW)
    t += rect(18, 470, 444, 64, m, rx=4)
    t += L('M60,500 L420,500', sw=4, color=tint(m, .5))
    doc = ''
    for i, c in enumerate(('#ECE6D6', '#F4EFE2', '#FFFFFF')):
        doc += rect(-96 + i*6, -62 - i*6, 186, 124, c, rx=4, sw=5)
    for i in range(5): doc += wavy(-70, -38 + i*20, 120 if i % 2 else 96)
    doc += S('<circle cx="58" cy="34" r="17" {a}/>', 'none', 5, ink=RED)  # 蓋章的紅圈：空心，沒有字
    t += g(doc, 'translate(196,410) rotate(-7)')
    t += rect(318, 312, 38, 76, '#E6D2A8', rx=12) + ell(337, 312, 19, 7, '#F1E3C6', 5) + rect(318, 380, 38, 14, RED, rx=3, sw=5)
    t += path('M354,428 L426,428 L426,446 Q390,458 354,446 Z', '#9A2A28', 6) + ell(390, 428, 36, 12, '#C8322E', 6)
    t += L('M44,350 C60,410 80,420 100,416', sw=4, color=GREY, dash='2 9')
    t += g(rect(0, -6, 92, 12, '#2F2C28', rx=5, sw=4) + path('M92,-6 L110,0 L92,6 Z', '#C9C6BE', 4), 'translate(100,416) rotate(-22)')
    t += sparkle(420, 120, 10, '#FFFFFF') + sparkle(70, 300, 8, tint(m, .4))
    return t

def c_single(m):  # 單親家庭：吊燈下的兩副碗筷、冰箱上的兩張便條
    t = L('M196,50 L196,110', sw=5)
    t += path('M150,150 Q196,96 242,150 Z', m) + ell(196, 152, 46, 8, '#FFF0B0', 4)
    t += soft(path('M160,160 L232,160 L290,330 L102,330 Z', '#FFF3B0', 0), '.45')
    t += rect(318, 96, 112, 300, tint(m, .6), rx=18) + L('M318,200 L430,200', sw=5) + L('M334,140 L334,180 M334,224 L334,280', sw=8)
    t += g(rect(-28, -26, 56, 52, '#F6E7A0', rx=3, sw=5) + wavy(-18, -8, 34, 3) + wavy(-18, 8, 26, 3), 'translate(388,150) rotate(8)')
    t += g(rect(-28, -26, 56, 52, tint(m, .55), rx=3, sw=5) + wavy(-18, -8, 34, 3) + wavy(-18, 8, 26, 3), 'translate(386,262) rotate(-6)')
    t += circ(388, 122, 6, RED, 3) + circ(386, 234, 6, '#3A6FB0', 3)
    t += (path('M36,350 L444,350 L464,450 L16,450 Z', WOOD, SW) + path('M120,350 L360,350 L372,450 L108,450 Z', tint(m, .25), 0)
          + L('M120,350 L108,450 M360,350 L372,450', sw=4, color=shade(m, .2)) + L('M60,450 L52,548 M420,450 L428,548', sw=12, color=shade(WOOD, .25)))
    for (x, y, c) in ((140, 392, '#FFFFFF'), (300, 386, tint(m, .2))):
        t += path(f'M{x-48},{y-20} Q{x},{y+44} {x+48},{y-20} Z', c, 6)
        t += path(f'M{x-42},{y-20} Q{x},{y-58} {x+42},{y-20} Z', '#FDFBF4', 5)
        t += L(f'M{x-44},{y-12} Q{x},{y+2} {x+44},{y-12}', sw=4, color=m if c == '#FFFFFF' else '#FFFFFF')
    t += L('M210,436 L262,408 M214,442 L268,416', sw=6, color='#8A5A33') + L('M362,436 L420,404 M368,442 L426,412', sw=6, color='#8A5A33')
    t += ell(222, 366, 30, 9, '#FFFFFF', 5) + path('M200,362 q10,-14 22,-4 q12,-12 22,4 Z', '#5E9E3A', 4)
    t += L('M130,350 q-6,-12 0,-24 M152,350 q6,-12 0,-24 M290,344 q-6,-12 0,-24 M312,344 q6,-12 0,-24', sw=4, color=GREY)
    return t

def c_cram(m):  # 補習班：換新的招牌（空白）、亮著日光燈的教室、樓下停滿機車
    t = path('M40,70 Q240,46 440,74 L440,300 L40,300 Z', '#33405C', 0)
    t += sparkle(70, 110, 7, '#F4E3A1') + sparkle(420, 150, 8, '#F4E3A1')
    t += rect(112, 92, 256, 398, '#E8E3D6', rx=4)
    t += rect(96, 120, 288, 74, m, rx=8) + rect(112, 134, 256, 46, tint(m, .35), rx=6, sw=0)
    t += sparkle(392, 108, 14, '#FFE47A') + sparkle(100, 112, 10, '#FFE47A') + sparkle(330, 210, 8, '#FFE47A')
    for y in (222, 312):
        t += rect(132, y, 216, 66, '#F3F8E6', rx=4, sw=6)
        t += L(f'M150,{y+10} L330,{y+10}', sw=4, color='#FFFFFF')
        for i, x in enumerate(range(156, 340, 34)):
            t += circ(x + (i % 2)*4, y + 54, 12, HAIR, 0)
    t += rect(206, 404, 70, 86, '#4B4640', rx=4)
    t += g(rect(-74, -24, 148, 48, '#BDB8AA', rx=6) + rect(-62, -14, 124, 28, '#D2CEC2', rx=4, sw=0), 'translate(70,420) rotate(-74)')
    t += scooter(140, 524, .82, '#E07A5F') + scooter(250, 528, .86, '#F2F0EA') + scooter(356, 524, .82, '#5A7DB5')
    return t

def c_care(m):  # 照顧長輩：輪椅上搭著毛毯和攤開的相簿、小桌上的一週藥盒
    t = path('M300,80 L420,80 L420,250 L300,250 Z', '#E8F1F4', 6) + L('M360,80 L360,250 M300,165 L420,165', sw=5)
    t += soft(path('M300,250 L420,250 L380,520 L160,520 Z', '#FFF6D6', 0), '.5')
    t += circ(196, 430, 84, 'none', 9) + circ(196, 430, 66, 'none', 4)
    for a in range(0, 180, 30):
        r = math.radians(a); t += L(f'M{196-62*math.cos(r):.0f},{430-62*math.sin(r):.0f} L{196+62*math.cos(r):.0f},{430+62*math.sin(r):.0f}', sw=3, color=GREY)
    t += circ(196, 430, 10, INK, 0)
    t += circ(318, 508, 18, '#4B4640', 6)
    t += tube('M134,200 L158,368 L292,368 L318,490 M292,368 L330,440 L372,440', '#9AA0A6', 10)
    t += tube('M134,200 L104,196 M150,300 L262,300 L264,360', '#9AA0A6', 8)
    t += path('M138,212 L156,352 L104,356 Q90,280 112,214 Z', m, 6)  # 毛毯：垂在椅背
    t += path('M150,346 L300,346 Q320,380 304,420 L250,426 Q200,400 152,370 Z', m, 6)
    for x in (174, 210, 246, 282): t += L(f'M{x},350 l-4,40', sw=4, color=tint(m, .45))
    alb = rect(-62, -30, 60, 60, '#F4EBD6', rx=3, sw=5) + rect(2, -30, 60, 60, '#F4EBD6', rx=3, sw=5)
    alb += rect(-54, -22, 44, 32, '#9CC3D9', rx=2, sw=3) + rect(10, -22, 44, 32, '#E8B88A', rx=2, sw=3)
    alb += path('M-54,10 L-40,-8 L-30,2 L-22,-10 L-10,10 Z', '#6E9E5A', 0) + circ(-44, -14, 4, '#F4E3A1', 0)  # 左：出遊的山景
    alb += path('M22,10 Q32,-6 42,10 Z', '#C8572B', 0) + circ(32, -8, 6, HAIR, 0)                          # 右：一個小孩的背影
    t += g(alb, 'translate(228,334) rotate(-8) scale(.9)')
    t += rect(318, 300, 92, 14, WOOD, rx=4) + L('M330,314 L330,410 M398,314 L398,410', sw=8, color=shade(WOOD, .25))
    cols = ['#E07A5F', '#F2CC5B', '#7FB685', '#5A9BD5', '#B58ACF', '#F29A2E', '#E86A92']
    t += rect(312, 270, 104, 30, '#F4F2EC', rx=5, sw=5)
    for i, c in enumerate(cols): t += rect(316 + i*14, 274, 11, 12, c, rx=2, sw=2)
    t += sparkle(120, 120, 10, m) + sparkle(250, 150, 7, m)
    return t

def c_filial(m):  # 孝親費：桌上的素面信封，兩隻手推來推去；旁邊攤開的記帳本
    t = path('M30,180 L450,140 L460,500 L20,520 Z', tint(m, .3), SW)
    for k in range(1, 6): t += L(f'M{30+k*72},{180-k*7} L{20+k*74},{520-k*3}', sw=3, color=tint(m, .55))
    for k in range(1, 5): t += L(f'M{28},{180+k*68} L{452},{140+k*72}', sw=3, color=tint(m, .55))
    bk = rect(-80, -60, 80, 120, '#FFFFFF', rx=3, sw=5) + rect(0, -60, 80, 120, '#FFFFFF', rx=3, sw=5)
    for i in range(5): bk += wavy(-68, -38 + i*20, 52, 3) + L(f'M14,{-38+i*20} l50,0', sw=3, color=GREY)
    bk += rect(-86, -66, 6, 132, m, rx=2, sw=0)
    t += g(bk, 'translate(150,430) rotate(6)')
    t += g(rect(0, -5, 100, 10, '#3A6FB0', rx=4, sw=4) + path('M100,-5 L116,0 L100,5 Z', '#F1D9A8', 4), 'translate(210,500) rotate(-24)')
    env = rect(-80, -50, 160, 100, '#FBF6EA', rx=4) + L('M-80,-50 L0,8 L80,-50', sw=5)
    t += g(env, 'translate(250,280) rotate(-8)')
    t += hand(354, 316, 196, tint(m, .1), SKIN)                     # 年輕的手：從右邊推過去
    t += hand(150, 236, 18, '#B5654A', '#E8BE98', old=True)          # 大人的手：從左上推回來
    t += motion(300, 200, 2, 30, 14, INK, -10) + motion(150, 330, 2, 30, 14, INK, 170)
    t += sparkle(400, 210, 10, '#FFFFFF')
    return t

def c_shop(m):  # 自家小店：糖果罐的櫃檯、後面貨架；角落的小桌子攤著作業
    t = rect(70, 70, 340, 200, '#F2EEDF', rx=6)
    for y in (130, 200): t += L(f'M70,{y} L410,{y}', sw=6, color=shade(WOOD, .2))
    goods = ['#E07A5F', '#5A9BD5', '#7FB685', '#F29A2E', '#B58ACF', '#E86A92', '#5A9BD5', '#F2CC5B']
    for i, c in enumerate(goods): t += rect(86 + i*40, 92 if i % 2 else 98, 30, 36 if i % 2 else 30, c, rx=3, sw=4)
    for i, c in enumerate(goods[::-1]): t += rect(84 + i*40, 158, 32, 40, c, rx=6, sw=4)
    t += path('M60,40 L420,40 L432,70 L48,70 Z', m, 6)
    for x in range(78, 420, 52): t += path(f'M{x},40 L{x+26},40 L{x+28},70 L{x+2},70 Z', '#FFFFFF', 0)
    t += rect(180, 270, 240, 30, m, rx=4) + rect(190, 300, 220, 200, '#B9784A', rx=4)
    for x in (230, 290, 350): t += L(f'M{x},310 L{x},490', sw=4, color=shade('#B9784A', .25))
    for (x, cols) in ((218, ('#E86A92', '#F2CC5B', '#7FB685')), (300, ('#5A9BD5', '#F29A2E', '#E07A5F')), (372, ('#B58ACF', '#F2CC5B', '#E86A92'))):
        t += path(f'M{x-26},270 L{x-26},210 Q{x},196 {x+26},210 L{x+26},270 Z', '#EAF3F1', 5) + rect(x-22, 190, 44, 16, '#D9D4C8', rx=4, sw=5)
        for k, c in enumerate(cols): t += circ(x - 12 + k*12, 256 - (k % 2)*16, 7, c, 3)
    t += ell(214, 270, 24, 6, '#C9C6BE', 4)
    t += rect(56, 404, 120, 14, WOOD, rx=3) + L('M66,418 L62,520 M166,418 L170,520', sw=8, color=shade(WOOD, .25))
    bk = rect(-40, -14, 40, 28, '#FFFFFF', rx=2, sw=4) + rect(0, -14, 40, 28, '#FFFFFF', rx=2, sw=4) + wavy(-34, -2, 24, 3) + wavy(6, -2, 24, 3)
    t += g(bk, 'translate(116,392) rotate(-4)')
    t += path('M86,470 L146,470 L140,530 L92,530 Z', RED, 6)
    t += circ(400, 360, 9, '#F2CC5B', 4) + sparkle(440, 120, 9, m)
    return t

def c_newyear(m):  # 過年客廳：牆上空白的斗方、八角糖果盒裡的瓜子和糖、一疊素面紅包
    t = g(rect(-48, -48, 96, 96, m, rx=4) + rect(-36, -36, 72, 72, 'none', rx=2, sw=4).replace(INK, '#F2C94C'), 'translate(330,150) rotate(45)')
    t += path('M30,330 L450,330 L460,450 L20,450 Z', '#7A3E2A', SW)
    t += L('M60,450 L56,540 M420,450 L424,540', sw=12, color='#5E2E20')
    pts = [(math.cos(math.radians(22.5 + 45*i))*104, math.sin(math.radians(22.5 + 45*i))*48) for i in range(8)]
    oct_ = 'M' + ' L'.join(f'{x:.0f},{y:.0f}' for x, y in pts) + ' Z'
    inner = 'M' + ' L'.join(f'{x*.62:.0f},{y*.62:.0f}' for x, y in pts) + ' Z'
    tray = path(oct_, '#B5182F', SW) + path(inner, '#F4E6C8', 5)
    for x, y in pts[::2]: tray += L(f'M{x*.62:.0f},{y*.62:.0f} L{x:.0f},{y:.0f}', sw=4)
    for (x, y) in ((-44, -4), (-36, 6), (-26, -6), (-50, 8), (-30, 14)): tray += ell(x, y, 7, 3.5, '#3B3330', 0, 30)
    for (x, y, c) in ((22, -6, '#F2C94C'), (40, 8, '#7FB685'), (14, 12, '#5A9BD5')): tray += ell(x, y, 9, 6, c, 3)
    for k in range(6):
        a = math.radians(22.5 + 45*k + 22.5); tray += ell(math.cos(a)*84, math.sin(a)*38, 7, 3, '#5A4A3E', 0, 20 + k*30)
    t += g(tray, 'translate(196,384)')
    t += ell(330, 372, 16, 5, '#5A4A3E', 0, 40) + ell(360, 400, 7, 3, '#5A4A3E', 0, -30) + ell(110, 430, 7, 3, '#5A4A3E', 0, 10)
    for i, rot in enumerate((-18, -4, 10)):
        t += g(rect(-30, -46, 60, 92, '#D41F3C', rx=5) + path('M-30,-22 Q0,-2 30,-22', 'none', 4) + circ(0, -4, 9, '#F2C94C', 4),
               f'translate({356 + i*16},{392 - i*6}) rotate({rot})')
    t += path('M84,300 L124,300 L118,336 L90,336 Z', '#FFFFFF', 5) + ell(104, 302, 18, 5, '#C08A3E', 0)
    t += sparkle(140, 120, 12, '#F2C94C') + sparkle(420, 270, 9, m) + sparkle(86, 220, 7, m)
    return t

# ------------------------------------------------------------------ 舊的 4 組（v1.2 規格 §4.1 回音）
def c_child(m):  # 童年回音：櫃子最上層打開的紙箱，露出接力棒、獎狀捲軸、直笛、蠟筆、掛繩鑰匙
    t = rect(60, 380, 360, 22, WOOD, rx=4) + L('M84,402 L84,470 M396,402 L396,470', sw=10, color=shade(WOOD, .25))
    t += rect(60, 470, 360, 20, WOOD, rx=4)
    # 箱子後面露出來的東西
    t += g(tube('M0,0 L0,-150', '#F4EBD6', 12) + rect(-9, -150, 18, 26, '#F4EBD6', rx=6, sw=5) + ''.join(circ(0, -40 - k*26, 3.5, INK, 0) for k in range(4)), 'translate(166,300) rotate(-16)')
    t += g(rect(-16, -110, 32, 110, RED, rx=14) + rect(-16, -74, 32, 34, '#FFFFFF', rx=0, sw=0), 'translate(226,296) rotate(4)')
    t += g(rect(-60, -16, 120, 32, '#F1E3BD', rx=14) + ell(-60, 0, 10, 16, '#E6D3A6', 5) + rect(-8, -18, 16, 36, m, rx=3, sw=4), 'translate(316,214) rotate(-28)')
    for k, c in enumerate(('#E07A5F', '#7FB685', '#B58ACF')):
        t += g(rect(-8, -70, 16, 70, c, rx=3, sw=4) + path('M-8,-70 L0,-88 L8,-70 Z', c, 4), f'translate({268 + k*20},{300 - k*6}) rotate({10 + k*8})')
    t += L('M110,300 Q100,200 136,180 Q160,170 150,230', sw=4, color='#E07A5F') + g(circ(0, 0, 11, '#F2CC5B', 5) + rect(-5, 8, 10, 30, '#F2CC5B', rx=2, sw=4), 'translate(150,232) rotate(-10)')
    # 紙箱
    t += path('M100,280 L380,280 L372,382 L108,382 Z', '#D9A86C', SW)
    t += path('M100,280 L74,236 L198,230 L210,280 Z', '#E8BE86', SW) + path('M380,280 L410,238 L290,228 L272,280 Z', '#E8BE86', SW)
    t += rect(150, 318, 180, 30, tint(m, .25), rx=4, sw=5)  # 標籤：空白
    t += sparkle(406, 160, 12, m) + sparkle(90, 170, 9, m) + sparkle(250, 140, 7, m)
    return t

def c_track(m):  # 選校回音：分成三條的路、三塊空白路牌；前景摺了一角的簡章和書包
    t = path('M50,250 Q240,220 430,250 L430,330 L50,330 Z', tint(m, .55), 0)
    t += path('M190,540 L290,540 L262,330 L224,330 Z', '#E9E2D2', 6)
    t += path('M224,330 L262,330 L250,300 L232,300 Z', '#E9E2D2', 4)
    t += path('M232,330 C200,300 150,290 96,286 L100,270 C160,272 214,282 240,316 Z', '#E9E2D2', 5)
    t += path('M254,330 C290,300 340,290 392,286 L388,270 C330,272 270,282 246,316 Z', '#E9E2D2', 5)
    t += tube('M240,330 L240,150', '#8A6A4A', 10)
    for (y, rot, c, flip) in ((170, -8, m, -1), (214, 6, tint(m, .35), 1), (254, -4, shade(m, .2), -1)):
        x0 = 240
        if flip < 0: d = f'M{x0},{y-18} L{x0-100},{y-18} L{x0-124},{y} L{x0-100},{y+18} L{x0},{y+18} Z'
        else: d = f'M{x0},{y-18} L{x0+100},{y-18} L{x0+124},{y} L{x0+100},{y+18} L{x0},{y+18} Z'
        t += g(path(d, c, 6), f'rotate({rot} {x0} {y})')
    t += circ(120, 120, 22, '#F2CC5B', 5) + L('M70,300 q20,-30 40,0 M360,300 q20,-26 40,0', sw=5, color=shade(m, .2))
    bro = path('M-90,-60 L70,-60 L90,-40 L90,60 L-90,60 Z', '#FFFFFF', 6) + path('M70,-60 L70,-40 L90,-40 Z', tint(m, .45), 5)
    bro += rect(-74, -46, 60, 44, tint(m, .3), rx=3, sw=4) + path('M-70,-8 L-54,-30 L-40,-18 L-28,-34 L-18,-8 Z', m, 0)
    for i in range(3): bro += wavy(0, -36 + i*18, 70, 3)
    for i in range(2): bro += wavy(-74, 20 + i*18, 150, 3)
    t += g(bro, 'translate(170,470) rotate(-8)')
    t += g(rect(-44, -50, 88, 92, '#4A5DB5', rx=16) + rect(-30, -10, 60, 34, tint('#4A5DB5', .3), rx=8, sw=5) + L('M-26,-50 Q0,-84 26,-50', sw=7), 'translate(350,482) rotate(8)')
    t += sparkle(400, 170, 10, m) + sparkle(80, 200, 8, m)
    return t

def c_branch(m):  # 分岔回音：天快亮的窗、書桌上的筆電、闔上的素面筆記本、馬克杯
    t = rect(96, 70, 290, 250, m, rx=6)
    t += path('M110,250 Q240,220 372,250 L372,306 L110,306 Z', '#F2A65A', 0) + path('M110,280 Q240,262 372,280 L372,306 L110,306 Z', '#F6D27A', 0)
    t += path('M200,306 a46,32 0 0 1 92,0 Z', '#FFE9A8', 5)
    t += L('M241,70 L241,320 M96,190 L386,190', sw=7)
    t += sparkle(140, 110, 8, '#F4E3A1') + sparkle(320, 130, 6, '#F4E3A1')
    t += path('M40,350 L440,350 L456,450 L24,450 Z', '#8A6A4A', SW) + L('M60,450 L56,548 M420,450 L424,548', sw=12, color=shade('#8A6A4A', .3))
    t += path('M170,300 L300,300 L306,392 L164,392 Z', '#3B3F52', 6) + path('M178,308 L292,308 L296,382 L174,382 Z', tint(m, .55), 0)
    t += path('M140,392 L330,392 L344,416 L126,416 Z', '#C9CBD2', 6)
    # 闔上的素面筆記本（看不出內容，大學、科大、上班三條線都說得通）
    nb = rect(-58, -40, 116, 80, '#5E7FA8', rx=6, sw=5) + rect(-58, -40, 14, 80, shade('#5E7FA8', .25), rx=4, sw=4)
    nb += L('M30,-40 L30,40', sw=5, color='#E8D9B0') + path('M-44,40 L56,40 L58,46 L-42,46 Z', '#F4EBD6', 4)
    t += g(nb, 'translate(110,410) rotate(-12)')
    t += path('M352,368 L398,368 L394,420 L356,420 Z', '#F4EBD6', 6) + path('M398,380 q20,4 0,28', 'none', 6)
    t += L('M366,356 q-6,-14 0,-26 M384,356 q6,-14 0,-26', sw=4, color=GREY)
    t += g(rect(0, -5, 90, 10, '#E07A5F', rx=4, sw=4) + path('M90,-5 L104,0 L90,5 Z', '#F1D9A8', 4), 'translate(196,444) rotate(-6)')
    return t

def c_home(m):  # 住處回音：門上插著鑰匙、小桌上蓋著蓋子的一鍋湯、亮著的檯燈
    t = rect(80, 80, 150, 420, m, rx=6) + rect(100, 104, 110, 150, tint(m, .3), rx=4, sw=5) + rect(100, 280, 110, 190, tint(m, .3), rx=4, sw=5)
    t += circ(206, 300, 9, '#F2CC5B', 5) + rect(200, 312, 12, 22, '#C9C6BE', rx=3, sw=4)
    t += g(L('M0,0 Q-10,30 4,52', sw=4, color=GREY) + circ(6, 60, 10, 'none', 4) + rect(-2, 66, 14, 26, '#7FB685', rx=5, sw=4), 'translate(206,330)')
    t += L('M60,500 L440,500', sw=6)
    t += soft(path('M338,206 L374,222 L420,378 L262,378 Z', '#FFF0B0', 0), '.5')
    t += rect(258, 380, 170, 16, WOOD, rx=4) + L('M272,396 L270,498 M414,396 L418,498', sw=9, color=shade(WOOD, .25))
    t += path('M282,326 L378,326 L372,378 L288,378 Z', '#5A7DB5', 6) + ell(330, 326, 50, 9, '#7E9CCB', 5) + circ(330, 314, 8, INK, 0)
    t += L('M274,338 l-14,0 M386,338 l14,0', sw=7)
    t += L('M306,296 q-8,-16 0,-32 t0,-32 M344,292 q-8,-16 0,-32 t0,-32', sw=5, color=GREY)
    t += rect(386, 370, 36, 10, '#4B4640', rx=4, sw=4) + tube('M404,372 L404,226 L372,190', '#4B4640', 6)
    t += path('M342,158 L398,180 L380,220 L326,198 Z', '#F2CC5B', 6)
    t += sparkle(270, 140, 10, m) + sparkle(430, 120, 8, m)
    return t

GROUPS = [
    # (組名, 主色, 函式, 傾斜, 一句畫面描述)
    ('teenjob', '#E2638F', c_teenjob,  -2, '打工店牆上掛著粉紅圍裙（名牌空白、口袋插筆），旁邊是手搖飲封口機和一杯封好的珍奶'),
    ('loan',    '#2FA84F', c_loan,      2, '銀行櫃檯的玻璃隔板前，一疊文件（波浪線、空心紅圈）、印章、印泥和鍊條筆'),
    ('single',  '#A8B82A', c_single,   -3, '吊燈下的餐桌擺著兩副碗筷和一盤青菜，冰箱上貼著兩張便條'),
    ('cram',    '#10BDB0', c_cram,      2, '晚上的補習班大樓換上嶄新的空白招牌，舊招牌靠在牆邊，教室亮著日光燈，樓下停滿機車'),
    ('care',    '#C08A9E', c_care,     -2, '窗邊的輪椅搭著毛毯，座位上攤開一本老相簿，旁邊小桌上是七格彩色藥盒'),
    ('filial',  '#4D5B52', c_filial,    3, '格子桌布上一個素面信封，年輕的手推過去、大人的手推回來，旁邊攤著記帳本和筆'),
    ('shop',    '#F5C800', c_shop,     -2, '自家小店的條紋遮雨棚、貨架和糖果罐櫃檯，角落小桌攤著作業，桌下一張紅色塑膠板凳'),
    ('newyear', '#E0144C', c_newyear,   2, '過年的茶几：八角糖果盒裡的瓜子和糖、一疊素面紅包、茶杯，牆上貼著空白斗方'),
    ('child',   '#62C6F5', c_child,    -2, '櫃子最上層打開的紙箱，露出接力棒、捲起來的獎狀、直笛、蠟筆和掛繩鑰匙（標籤空白）'),
    ('track',   '#8A5CD6', c_track,     3, '路分成三條，路標三塊空白箭頭指向不同方向；前景是摺了一角的簡章和書包'),
    ('branch',  '#262A4E', c_branch,   -3, '天快亮的窗外露出一點日出，書桌上開著筆電、一本闔上的素面筆記本和一杯冒煙的馬克杯'),
    ('home',    '#F59C72', c_home,      2, '門上插著掛繩鑰匙，旁邊小桌上一鍋蓋著蓋子、冒著熱氣的湯，檯燈還亮著'),
]

def card_svg(gid, main, fn, tilt, seed):
    feat = fn(main)
    blob_rot = -tilt * 1.5
    bg = (f'<rect width="{W}" height="{H}" fill="{PAPER}"/>'
          f'<g filter="url(#crayon)"><g filter="url(#blob)"><rect x="52" y="64" width="376" height="472" rx="90" fill="{tint(main, .72)}" transform="rotate({blob_rot} 240 300)"/></g></g>'
          f'<g filter="url(#blob)" opacity=".5"><circle cx="{110 if tilt > 0 else 380}" cy="{120 if tilt > 0 else 500}" r="34" fill="{tint(main, .5)}"/></g>')
    body = f'<g transform="rotate({tilt} 240 300)">{feat}</g>'
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">'
           f'<!-- 《台灣人生》回音牌插圖 echo_{gid}｜主色 {main}｜art/deck/echo/src/gen_echo.py 產生，請改產生器不要手改 -->'
           + DEFS.format(s1=seed, s2=seed + 7, s3=seed + 13, s4=seed + 21, s5=seed + 29) + bg + body +
           f'<rect width="{W}" height="{H}" filter="url(#grain)"/></svg>')
    assert '<text' not in svg and '<tspan' not in svg, gid
    return svg

def echo_ids():
    """data/deck/cards_v12.json 裡所有回音牌 id（e_<組名>_bitter／_warm）。"""
    d = json.load(open(os.path.join(ROOT, 'data', 'deck', 'cards_v12.json'), encoding='utf-8'))
    ids = set()
    def walk(o):
        if isinstance(o, dict):
            if o.get('echo_card') and str(o.get('id', '')).startswith('e_'): ids.add(o['id'])
            for v in o.values(): walk(v)
        elif isinstance(o, list):
            for v in o: walk(v)
    walk(d)
    return ids

def main():
    ids = echo_ids()
    man = {'_note': '回音牌插圖（美術設計）。每組一張，苦版和暖版共用。4:5 母版 480×600（src/*.svg），主體在安全區 x 80–400、y 60–540；png＝600×750（96 色調色盤 PNG），webp＝寬 480（480×600，品質 82）。對應：卡片 id 去掉 _bitter/_warm、再去掉 e_ → 組名 → echo_<組名>.webp，找不到退回 .png，再找不到用實心缺圖樣式。',
           'ratio': '4:5', 'size': [W, H], 'png_size': [600, 750], 'webp_size': [480, 600], 'safe_zone': [80, 60, 400, 540], 'groups': {}}
    for i, (gid, main_c, fn, tilt, subj) in enumerate(GROUPS):
        cards = [f'e_{gid}_bitter', f'e_{gid}_warm']
        miss = [c for c in cards if c not in ids]
        if miss: print('⚠️ cards_v12.json 找不到', miss); sys.exit(1)
        open(os.path.join(HERE, f'echo_{gid}.svg'), 'w', encoding='utf-8').write(card_svg(gid, main_c, fn, tilt, 101 + i * 3))
        man['groups'][gid] = {'id': f'echo_{gid}', 'group': gid, 'accent': main_c, 'cards': cards,
                              'webp': f'art/deck/echo/echo_{gid}.webp', 'png': f'art/deck/echo/echo_{gid}.png', 'svg': f'art/deck/echo/src/echo_{gid}.svg',
                              'subject': subj}
    todo = sorted({c[2:].rsplit('_', 1)[0] for c in ids} - {g[0] for g in GROUPS})
    if todo: man['_todo'] = todo
    json.dump(man, open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('wrote', len(GROUPS), 'todo', todo)

if __name__ == '__main__':
    main()
