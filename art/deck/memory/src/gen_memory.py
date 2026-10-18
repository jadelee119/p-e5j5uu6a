#!/usr/bin/env python3
"""童年記憶牌插圖產生器（美術設計）。
輸出：art/deck/memory/<id>.svg（4:5，480×600）＋ manifest.json。PNG 由 render.mjs 匯出。
風格：手繪抖線（feTurbulence＋feDisplacementMap，填色和描線用不同亂數＝套色微偏）、紙紋、每張自己的主色。
規則：圖裡不放任何文字、字母、數字；人物臉一律空白。"""
import json, os, re, sys, math, random

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, '..'))
W, H = 480, 600
INK = '#33302B'; PAPER = '#FBFAF6'; SKIN = '#F2D3B5'; HAIR = '#3B3330'
RED = '#C8322E'; CREAM = '#F4EBD6'; WOOD = '#C89A63'; GREY = '#8E8A82'

def hx(c): c = c.lstrip('#'); return [int(c[i:i+2], 16) for i in (0, 2, 4)]
def mix(a, b, t):  # t=0 → a, t=1 → b
    A, B = hx(a), hx(b); return '#%02X%02X%02X' % tuple(round(A[i] + (B[i]-A[i])*t) for i in range(3))
def tint(c, t): return mix(c, PAPER, t)
def shade(c, t): return mix(c, '#1E1B18', t)

SW = 7  # 描線粗細（480 寬；縮到 84px 約 1.2px）

def S(el, fill, sw=SW, ink=INK, op=None):
    """el 是含 {a} 的元素樣板：先填色（filter wf）再描線（filter wl），兩層抖動不同＝手繪套色感。"""
    o = f' opacity="{op}"' if op else ''
    out = ''
    if fill and fill != 'none':
        out += el.format(a=f'fill="{fill}" stroke="none" filter="url(#wf)"{o}')
    if sw:
        out += el.format(a=f'fill="none" stroke="{ink}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" filter="url(#wl)"')
    return out
def F(el, fill, op=None):
    return S(el, fill, sw=0, op=op)
def L(d, sw=SW, color=INK, dash=None, op=None):
    da = f' stroke-dasharray="{dash}"' if dash else ''
    o = f' opacity="{op}"' if op else ''
    return f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round"{da}{o} filter="url(#wl)"/>'
def tube(d, color, w=16):
    """粗管子（鐵架、繩子）：墨線外框＋色芯。"""
    return (f'<path d="{d}" fill="none" stroke="{INK}" stroke-width="{w+SW*1.4}" stroke-linecap="round" stroke-linejoin="round" filter="url(#wl)"/>'
            f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round" filter="url(#wf)"/>')
def circ(cx, cy, r, fill, sw=SW): return S(f'<circle cx="{cx}" cy="{cy}" r="{r}" {{a}}/>', fill, sw)
def ell(cx, cy, rx, ry, fill, sw=SW, rot=0):
    return S(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" transform="rotate({rot} {cx} {cy})" {{a}}/>', fill, sw)
def rect(x, y, w, h, fill, rx=6, sw=SW, rot=0):
    return S(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" transform="rotate({rot} {x+w/2} {y+h/2})" {{a}}/>', fill, sw)
def path(d, fill, sw=SW): return S(f'<path d="{d}" {{a}}/>', fill, sw)
def g(content, tr): return f'<g transform="{tr}">{content}</g>'

def sparkle(x, y, r, color):
    return L(f'M{x-r},{y} L{x+r},{y} M{x},{y-r} L{x},{y+r}', sw=5, color=color)
def note(x, y, s, color):
    return g(ell(0, 0, 13, 10, color, 5, -20) + L('M11,-4 L11,-44 Q24,-38 30,-26', sw=5), f'translate({x},{y}) scale({s})')
def motion(x, y, n=3, length=40, gap=16, color=INK, ang=0, sw=5):
    d = ' '.join(f'M{x},{y+i*gap} l{length},0' for i in range(n))
    return g(L(d, sw=sw, color=color), f'rotate({ang} {x} {y})')

def kid(x, y, s=1.0, shirt='#5A7DB5', pose='stand', pants='#4B4640', cap=None, bag=None, back=False):
    """空白臉的小孩剪影。(x, y)＝腳底中心。"""
    k = ''
    hy = -150
    # 腿
    if pose == 'sit':
        k += L('M-14,-62 L-20,-30 L-24,0 M14,-62 L22,-30 L26,0', sw=14, color=pants)
    elif pose == 'jump':
        k += L('M-12,-62 L-30,-38 L-18,-14 M12,-62 L30,-38 L20,-14', sw=14, color=pants)
    elif pose == 'run':
        k += L('M-10,-62 L-34,-34 L-52,-28 M10,-62 L22,-30 L18,0', sw=14, color=pants)
    else:
        k += L('M-12,-62 L-16,0 M12,-62 L16,0', sw=14, color=pants)
    if bag:
        k += rect(-46 if not back else -34, -128, 34 if not back else 68, 60, bag, rx=10, sw=5)
    # 身體
    k += path('M-30,-122 Q0,-134 30,-122 L36,-58 Q0,-50 -36,-58 Z', shirt, 6)
    # 手
    arms = {
        'stand': 'M-28,-116 L-44,-80 L-46,-60 M28,-116 L44,-80 L46,-60',
        'sit': 'M-28,-116 L-44,-84 L-30,-66 M28,-116 L44,-84 L30,-66',
        'wave': 'M-28,-116 L-44,-80 L-46,-60 M28,-116 L56,-146 L64,-180',
        'raise': 'M-28,-116 L-44,-80 L-46,-60 M24,-120 L36,-160 L40,-198',
        'jump': 'M-28,-116 L-58,-128 L-74,-150 M28,-116 L58,-128 L74,-150',
        'run': 'M-28,-116 L-54,-100 L-62,-76 M28,-116 L50,-136 L72,-130',
        'hold': 'M-28,-116 L-30,-86 L-6,-80 M28,-116 L30,-86 L6,-80',
    }[pose if pose in ('stand','sit','wave','raise','jump','run','hold') else 'stand']
    k += L(arms, sw=12, color=SKIN) + L(arms, sw=3, color=INK, op=.0)
    # 頭（空白臉）＋頭髮
    k += circ(0, hy, 26, SKIN, 6)
    if back:
        k += circ(0, hy, 26, HAIR, 6)
    else:
        k += path(f'M-27,{hy-2} Q-24,{hy-32} 2,{hy-28} Q26,{hy-28} 27,{hy-4} Q8,{hy-16} -27,{hy-2} Z', HAIR, 0)
    if cap:
        k += path(f'M-28,{hy-6} Q-26,{hy-36} 0,{hy-34} Q26,{hy-36} 28,{hy-6} Z', cap, 5) + path(f'M20,{hy-10} L50,{hy-6} L22,{hy-2} Z', cap, 5)
    return g(k, f'translate({x},{y}) scale({s})')

# ------------------------------------------------------------------ 30 張
def c_contact_book(m):  # 聯絡簿
    t = path('M92,168 L242,184 L388,166 L396,452 L242,470 L86,450 Z', m, SW)
    t += path('M108,180 L240,196 L240,446 L104,430 Z', PAPER) + path('M240,196 L374,178 L380,428 L240,446 Z', PAPER)
    for i in range(7):
        y = 230 + i*28
        t += L(f'M124,{y-6+i*0.5} q24,-6 46,0 t46,0', sw=4, color=GREY) if i % 3 else L(f'M124,{y-6} l90,8', sw=4, color=GREY)
        t += L(f'M258,{y} l100,-9', sw=4, color=GREY)
    t += S('<ellipse cx="306" cy="256" rx="70" ry="24" transform="rotate(-6 306 256)" {a}/>', 'none', 6, ink=RED)
    t += L('M262,405 c12,-26 22,12 32,-10 s14,16 28,-4 s12,10 24,-2', sw=5, color=shade(m, .2))
    t += g(rect(250, 0, 150, 30, '#E9B949', rx=4, sw=6) + path('M400,0 L436,15 L400,30 Z', '#F1D9A8', 6) + path('M424,10 L436,15 L424,20 Z', INK, 0) + rect(228, 0, 26, 30, '#E59AA0', rx=6, sw=6),
           'translate(-40,520) rotate(-32 330 15)')
    return t

def c_homework_first(m):  # 先寫功課：電視在後、習作在前
    t = ''
    t += L('M206,104 L168,46 M206,104 L250,50', sw=6) + circ(168, 46, 7, INK, 0) + circ(250, 50, 7, INK, 0)
    t += rect(104, 100, 214, 168, tint(m, .35), rx=26)
    t += rect(122, 118, 146, 128, '#E8F3F1', rx=22)
    for i, c in enumerate(['#E07A5F', '#F2CC5B', '#7FB685']):
        r = 52 - i*12
        t += L(f'M{195-r},214 A{r},{r} 0 0 1 {195+r},214', sw=9, color=c)
    t += circ(290, 144, 9, INK, 0) + circ(290, 178, 9, INK, 0)
    t += note(352, 128, 1.0, m) + note(398, 84, .8, m)
    t += path('M70,330 L392,296 L412,516 L88,540 Z', PAPER, SW)
    t += L('M240,314 L250,528', sw=4, color=GREY)
    for r in range(3):
        for cc in range(3):
            x = 104 + cc*40 + r*1; y = 352 + r*52 - cc*4
            t += rect(x, y, 30, 30, 'none', rx=3, sw=4)
            t += L(f'M{x+7},{y+16} l7,7 l11,-15', sw=4, color=m)
        for cc in range(3):
            x = 266 + cc*40 + r*2; y = 336 + r*52 - cc*4
            last = (r == 2 and cc == 2)
            t += rect(x, y, 30, 30, tint(m, .7) if last else 'none', rx=3, sw=5 if last else 4)
            if not last: t += L(f'M{x+7},{y+16} l7,7 l11,-15', sw=4, color=m)
    t += g(rect(0, 0, 130, 24, m, rx=4, sw=6) + path('M130,0 L160,12 L130,24 Z', '#F1D9A8', 6), 'translate(250,470) rotate(-14)')
    return t

def c_recess(m):  # 下課十分鐘：盪鞦韆＋鬼抓人
    t = ''
    for d in ['M110,520 L170,150 L232,520', 'M300,520 L360,150 L420,520']:
        t += tube(d, tint(m, .1), 14)
    t += tube('M150,152 L380,152', shade(m, .15), 16)
    t += L('M200,160 A150,150 0 0 0 150,420', sw=5, color=m, dash='4 16')
    t += L('M250,160 L322,372 M300,160 L366,360', sw=5)
    t += g(rect(-40, -10, 84, 20, '#E2A33B', rx=6, sw=6), 'translate(346,372) rotate(-18)')
    t += g(kid(0, 0, .82, '#E07A5F', 'sit'), 'translate(352,412) rotate(-18)')
    t += kid(150, 548, .62, '#F2CC5B', 'run') + motion(54, 460, 3, 30, 14, m)
    t += L('M60,540 q10,-22 16,0 M396,546 q8,-18 14,0', sw=5, color=m)
    return t

def c_dusk_slide(m):  # 玩到天黑
    sky = shade(m, .35)
    t = path('M60,120 Q240,60 420,110 L430,470 Q240,500 54,470 Z', sky, 0)
    t += path('M342,128 a38,38 0 1 0 30,56 a30,30 0 1 1 -30,-56 Z', '#F4E3A1', 5)
    t += sparkle(118, 150, 10, '#F4E3A1') + sparkle(250, 120, 7, '#F4E3A1') + sparkle(410, 230, 7, '#F4E3A1')
    t += tube('M330,520 L330,250 M390,520 L390,250', '#E9A04A', 12)
    for y in (300, 350, 400, 450): t += L(f'M330,{y} L390,{y}', sw=8)
    t += path('M318,236 L402,236 L402,258 L318,258 Z', '#E9A04A', 6)
    t += path('M320,250 C250,262 220,330 170,420 Q150,460 96,470 L92,500 Q170,500 196,452 C240,370 270,300 330,290 Z', '#F2C14E', SW)
    t += kid(358, 236, .62, tint(m, .25), 'raise')
    for i in range(3):
        r = 26 + i*22
        t += L(f'M96,{330-r*0.7} A{r},{r} 0 0 1 96,{330+r*0.7}', sw=6, color='#F4E3A1')
    t += path('M40,520 Q240,490 440,520 L440,560 L40,560 Z', shade(m, .1), 0)
    return t

def c_training_wheel(m):  # 拆掉輔助輪
    t = ''
    for cx in (148, 330):
        t += circ(cx, 396, 66, 'none', 9) + circ(cx, 396, 10, INK, 0)
        for a in range(0, 180, 45):
            r = math.radians(a); t += L(f'M{cx-58*math.cos(r):.0f},{396-58*math.sin(r):.0f} L{cx+58*math.cos(r):.0f},{396+58*math.sin(r):.0f}', sw=3, color=GREY)
    t += tube('M148,396 L222,300 L312,300 L330,396 M222,300 L246,396 L148,396 M246,396 L312,300', m, 14)
    t += tube('M312,300 L302,250', m, 12) + L('M280,246 Q302,236 330,252', sw=12)
    t += tube('M222,300 L212,262', m, 12) + path('M180,250 Q212,236 244,252 Q212,268 180,258 Z', INK, 0)
    t += g(circ(0, 0, 26, '#F2F0EA', 7) + circ(0, 0, 7, INK, 0) + L('M0,0 L-46,-30 L-40,-50', sw=7, color=GREY), 'translate(362,498) rotate(18)')
    t += L('M332,462 q-6,-12 2,-22 M394,464 q8,-10 2,-24', sw=5, color=m)
    t += g(rect(-48, -17, 96, 34, '#EFC9A4', rx=16, sw=6) + rect(-16, -17, 32, 34, '#F7E3CF', rx=2, sw=0) +
           ''.join(circ(dx, dy, 2.5, '#C9A07B', 0) for dx in (-8, 0, 8) for dy in (-7, 7)), 'translate(132,174) rotate(-28)')
    t += path('M80,470 Q240,476 440,466', 'none', 5)
    return t

def c_jump_rope(m):  # 跳繩比賽
    t = ''
    for i, op in enumerate((.25, .45)):
        t += L(f'M{180-i*8},382 C{120-i*30},{200-i*40} {360+i*30},{200-i*40} {300+i*8},382', sw=7, color=m, op=op)
    t += ell(240, 528, 66, 12, tint(INK, .75), 0)
    t += kid(240, 470, 1.05, tint(m, .2), 'jump')
    t += L('M166,300 C120,560 360,560 314,300', sw=9, color=m)
    t += circ(166, 300, 9, '#F2CC5B', 5) + circ(314, 300, 9, '#F2CC5B', 5)
    for (x, y) in ((120, 470), (360, 470)): t += L(f'M{x-20},{y+20} q20,-14 40,0', sw=5, color=GREY)
    for (x, y, r) in ((96, 180, 14), (392, 160, 12), (90, 330, 9), (404, 320, 10), (240, 120, 9)):
        t += sparkle(x, y, r, m)
    return t

def c_metronome(m):  # 學鋼琴：節拍器
    t = path('M196,128 L284,128 L336,446 L144,446 Z', m, SW)
    t += path('M214,176 L266,176 L298,420 L182,420 Z', tint(m, .75), 5)
    t += L('M240,410 L292,186', sw=6) + g(rect(-14, -12, 28, 24, '#E9B949', rx=3, sw=5), 'translate(278,246) rotate(13)')
    t += L('M300,150 A120,120 0 0 1 340,190', sw=5, color=m) + L('M180,150 A120,120 0 0 0 140,190', sw=5, color=m, op=.5)
    t += circ(240, 410, 9, INK, 0)
    t += rect(56, 468, 368, 92, '#FFFFFF', rx=6)
    for i in range(1, 8): t += L(f'M{56+i*46},470 L{56+i*46},556', sw=4)
    for i in (0, 1, 3, 4, 5, 7):
        x = 56 + (i+1)*46 - 13
        if x < 410: t += rect(x, 468, 26, 52, INK, rx=3, sw=0)
    return t

def c_crayons(m):  # 一盒蠟筆
    t = g(rect(80, 70, 320, 210, PAPER, rx=4, sw=5) + circ(150, 140, 30, '#F2CC5B', 0) + L('M150,92 l0,-10 M196,140 l10,0 M184,108 l8,-8', sw=5, color='#E0A23B') +
          L('M110,240 C160,190 210,260 270,210 S350,180 380,230', sw=9, color='#5FA35A') + L('M250,130 l40,-30 l40,30 M262,124 l0,50 l56,0 l0,-50', sw=7, color='#E07A5F'),
          'rotate(-5 240 175)')
    cols = ['#D9453B', '#F2A33B', '#F2D04B', '#4E9E52', '#3A7DC0', '#8A4FA0', '#7A4E2D']
    for i, c in enumerate(cols):
        x = 150 + i*28; h = [74, 98, 82, 108, 90, 70, 86][i]
        y = 330 - h
        t += rect(x, y, 22, h+20, c, rx=3, sw=5) + path(f'M{x},{y} L{x+11},{y-24} L{x+22},{y} Z', c, 5) + L(f'M{x+2},{y+22} l18,0', sw=3, color=PAPER)
    t += path('M128,316 L352,316 L362,530 L118,530 Z', m, SW)
    t += path('M128,316 L352,316 L342,368 L138,368 Z', shade(m, .2), 5)
    t += path('M240,404 l10,22 l24,2 l-18,16 l6,24 l-22,-12 l-22,12 l6,-24 l-18,-16 l24,-2 Z', '#F2D04B', 5)
    return t

def c_shop_stool(m):  # 店裡的小板凳
    t = rect(78, 210, 324, 230, tint(m, .78), rx=4)
    t += path('M70,112 L410,112 L428,206 L52,206 Z', PAPER, SW)
    for i in range(0, 8, 2):
        x0 = 70 + i*42.5; x1 = 52 + i*47
        t += path(f'M{x0},112 L{x0+42.5},112 L{x1+47},206 L{x1},206 Z', m, 0)
    sc = ''.join(f'a23.5,20 0 0 0 47,0 ' for _ in range(8))
    t += path(f'M52,206 {sc} Z', m, 6)
    t += rect(96, 300, 288, 140, WOOD, rx=4)
    t += rect(116, 250, 70, 50, '#F4E3A1', rx=4, sw=5) + rect(290, 262, 60, 38, '#9CC7D9', rx=4, sw=5)
    t += path('M188,500 L292,500 L300,474 L180,474 Z', RED, 6) + L('M192,500 L176,552 M288,500 L304,552 M200,500 L240,552 L280,500', sw=8, color=RED) + L('M192,500 L176,552 M288,500 L304,552', sw=3)
    t += kid(240, 480, .74, '#5C8FC9', 'wave')
    t += L('M318,312 q10,-8 0,-18 M334,322 q18,-14 0,-34', sw=5, color=shade(m, .2))
    return t

def c_key_ricecooker(m):  # 脖子上的鑰匙＋電鍋
    t = ''
    t += path('M158,264 C160,196 366,196 368,264 Z', tint(m, .55), SW)
    t += path('M150,262 L376,262 L384,286 L142,286 Z', m, 6)
    t += path('M156,286 L370,286 L364,470 Q263,490 162,470 Z', m, SW)
    t += path('M162,350 Q263,362 364,350', 'none', 5)
    t += rect(124, 300, 34, 22, shade(m, .25), rx=8, sw=5) + rect(368, 300, 34, 22, shade(m, .25), rx=8, sw=5)
    t += rect(242, 392, 42, 34, PAPER, rx=6, sw=5) + rect(254, 400, 18, 12, RED, rx=2, sw=0)
    t += rect(240, 194, 46, 22, shade(m, .25), rx=10, sw=5)
    t += L('M236,176 q-14,-18 0,-36 t0,-36 M292,176 q14,-18 0,-36 t0,-36', sw=5, color=GREY)
    t += L('M74,64 C66,180 100,250 120,262 M120,262 C140,230 150,140 168,70', sw=5, color=RED)
    t += g(circ(0, 0, 22, '#E2B13C', 6) + circ(0, 0, 7, PAPER, 4) + rect(-7, 18, 14, 70, '#E2B13C', rx=3, sw=6) + path('M7,58 l14,0 l0,10 l-8,0 l0,10 l-6,0', '#E2B13C', 5),
           'translate(120,282) rotate(-8)')
    t += path('M120,494 Q263,512 410,494', 'none', 5)
    return t

def c_after_school(m):  # 安親班：路隊走進去
    t = path('M300,150 L430,150 L430,520 L300,520 Z', tint(m, .7), SW)
    t += path('M290,150 L440,150 L430,118 L300,118 Z', m, 6)
    t += rect(318, 168, 94, 34, PAPER, rx=4, sw=5)
    for r in range(2):
        for c in range(2): t += rect(320 + c*52, 222 + r*70, 40, 48, '#CFE3EE', rx=3, sw=5)
    t += path('M340,520 L340,420 Q366,400 392,420 L392,520 Z', m, 6)
    caps = '#F2C94C'
    for i, (x, s) in enumerate([(110, .72), (180, .72), (250, .72)]):
        t += kid(x, 528 - i*4, s, tint(m, .35) if i != 1 else tint(m, .1), 'stand', cap=caps, bag=shade(m, .1))
    t += L('M70,540 L430,530', sw=5)
    t += L('M146,420 L146,300', sw=6) + path('M146,302 L206,320 L146,340 Z', '#F2C94C', 5)
    return t

def c_library_card(m):  # 借書卡
    t = rect(100, 190, 120, 320, shade(m, .25), rx=8, rot=-6) + rect(140, 170, 110, 340, tint(m, .3), rx=8, rot=-2)
    t += path('M196,150 L380,166 L370,510 L186,494 Z', m, SW)
    t += path('M214,360 L362,372 L356,476 L208,464 Z', '#E9D9B8', 6)
    t += g(rect(0, 0, 126, 220, '#FFF9EC', rx=4, sw=6) + L('M0,34 L126,34', sw=4, color=RED) + L('M42,34 L42,220', sw=3, color=GREY) +
           ''.join(L(f'M52,{56+i*28} c8,-12 14,8 22,-4 s10,8 20,-2 s8,6 16,0', sw=4, color=m) for i in range(6)),
           'translate(226,226) rotate(-10 63 110)')
    t += sparkle(400, 150, 12, m) + sparkle(110, 140, 9, m)
    return t

def c_trading_cards(m):  # 抽屜裡的卡牌
    t = rect(60, 330, 360, 200, WOOD, rx=6)
    t += rect(90, 360, 300, 110, shade(WOOD, .15), rx=4)
    t += rect(206, 400, 68, 20, CREAM, rx=8, sw=5)
    cards = [(-30, '#E07A5F', 'star'), (-12, '#4E8FC9', 'circle'), (6, m, 'flame'), (24, '#F2C14E', 'bolt')]
    for i, (rot, c, sym) in enumerate(cards):
        sy = {'star': 'M0,-26 L7,-8 L26,-8 L11,4 L17,24 L0,12 L-17,24 L-11,4 L-26,-8 L-7,-8 Z',
              'circle': 'M-22,0 a22,22 0 1 0 44,0 a22,22 0 1 0 -44,0',
              'flame': 'M0,-30 C20,-6 20,14 0,26 C-20,14 -18,-4 -6,-12 C-6,0 4,4 0,-30 Z',
              'bolt': 'M6,-30 L-14,4 L0,4 L-6,30 L16,-6 L2,-6 Z'}[sym]
        t += g(rect(-48, -150, 96, 136, PAPER, rx=8) + rect(-38, -140, 76, 80, tint(c, .55), rx=4, sw=4) + path(sy, c, 5) + L('M-30,-42 L30,-42 M-30,-28 L14,-28', sw=4, color=GREY),
               f'translate({240 + (i-1.5)*58},{380}) rotate({rot})'.replace('translate(', 'translate(').replace('rotate(', 'rotate(')) if False else \
             g(g(rect(-48, -136, 96, 136, PAPER, rx=8) + rect(-38, -126, 76, 76, tint(c, .55), rx=4, sw=4) + g(path(sy, c, 5), 'translate(0,-88)') + L('M-30,-34 L30,-34 M-30,-20 L14,-20', sw=4, color=GREY),
               f'rotate({rot})'), f'translate({240 + (i-1.5)*62},{392})')
    t += sparkle(98, 160, 12, m) + sparkle(392, 150, 14, m)
    return t

def c_computer_class(m):  # 電腦課：一秒切回來
    t = rect(96, 110, 288, 240, '#E6DDC8', rx=22)
    t += rect(120, 132, 240, 190, shade(m, .3), rx=16)
    t += path('M120,148 Q120,132 136,132 L250,132 L210,322 L136,322 Q120,322 120,306 Z', m, 0)
    for (x, y, c) in ((140, 160, '#F2C14E'), (164, 160, '#F2C14E'), (164, 184, '#E07A5F'), (140, 250, '#9CD3E8'), (164, 250, '#9CD3E8'), (188, 250, '#9CD3E8'), (140, 274, '#E07A5F'), (164, 274, '#E07A5F'), (188, 274, '#F2C14E')):
        t += rect(x, y, 22, 22, c, rx=2, sw=3)
    t += path('M250,132 L344,132 Q360,132 360,148 L360,306 Q360,322 344,322 L210,322 Z', '#FFFFFF', 0)
    for i in range(5): t += L(f'M{236-i*7+10},{160+i*30} L{340},{160+i*30}', sw=4, color=GREY)
    t += rect(120, 132, 240, 190, 'none', rx=16)
    t += L('M232,124 L196,334', sw=6, color=PAPER) + L('M268,100 q30,10 26,40 M282,86 q48,20 38,70', sw=5, color=m)
    t += path('M200,350 L280,350 L296,384 L184,384 Z', '#D8CDB4', 6)
    t += path('M100,420 L380,420 L400,486 L80,486 Z', '#E6DDC8', SW)
    for r in range(2):
        for c in range(9): t += rect(104 + c*30 - r*6, 432 + r*24, 22, 16, '#F4EEE0', rx=3, sw=3)
    t += ell(424, 470, 20, 28, '#E6DDC8', 6) + L('M424,442 C424,410 400,400 392,420', sw=4)
    return t

def c_dodgeball(m):  # 躲避球
    t = path('M70,300 L410,300 L450,540 L30,540 Z', tint(m, .8), 0)
    t += L('M70,300 L410,300 L450,540 L30,540 Z', sw=6, color=PAPER, dash='22 14') + L('M70,300 L410,300 L450,540 L30,540 Z', sw=3, color=m, dash='22 14')
    t += ell(240, 506, 56, 10, tint(INK, .75), 0)
    t += g(kid(0, 0, 1.0, m, 'jump'), 'translate(240,490) rotate(-12)')
    t += circ(352, 186, 34, '#E9A04A', 6) + L('M322,176 Q352,196 384,180 M346,154 Q356,186 344,218', sw=4)
    t += motion(430, 210, 3, 46, 14, m, ang=180) if False else L('M396,166 l30,-8 M400,190 l30,-3 M396,214 l30,3', sw=5, color=m)
    for (x, y) in ((70, 210), (110, 150), (150, 110), (330, 100), (300, 140)):
        t += L(f'M{x},{y} l-8,-16 M{x+10},{y-4} l2,-18 M{x+20},{y} l10,-14', sw=4, color=m)
    return t

def c_alley_hoop(m):  # 巷口打球
    t = path('M54,90 Q240,60 426,96 L426,520 L54,520 Z', tint(shade(m, .45), .15), 0)
    t += rect(100, 220, 96, 300, '#D7CFC0', rx=2) + rect(296, 260, 130, 260, '#CFC6B5', rx=2)
    for r in range(3): t += rect(122, 250 + r*80, 50, 44, '#F4D27A', rx=3, sw=5)
    t += rect(318, 290, 46, 40, '#F4D27A', rx=3, sw=5)
    t += tube('M226,540 L226,200', GREY, 12)
    t += rect(160, 130, 132, 90, PAPER, rx=4) + rect(200, 168, 52, 36, 'none', rx=2, sw=5)
    t += ell(226, 232, 40, 10, '#E05A3A', 6)
    t += circ(330, 168, 34, m, 6) + L('M298,160 Q330,182 362,166 M326,134 Q340,168 324,202', sw=4)
    t += L('M374,214 q20,30 10,70 M392,200 q30,40 20,96', sw=4, color=PAPER, dash='2 12')
    t += circ(380, 112, 12, '#FFF3B0', 4) + L('M380,124 L380,140', sw=5)
    t += path('M40,520 L440,520 L440,560 L40,560 Z', '#7F7A70', 0)
    return t

def c_recorder(m):  # 直笛
    body = (rect(-20, -190, 40, 70, CREAM, rx=16) + rect(-17, -130, 34, 230, CREAM, rx=10) + path('M-17,96 L17,96 L28,150 L-28,150 Z', CREAM, SW) +
            rect(-21, -128, 42, 14, '#B98652', rx=5, sw=5) + rect(-20, 90, 40, 14, '#B98652', rx=5, sw=5) +
            path('M-9,-168 L9,-168 L5,-152 L-5,-152 Z', INK, 0) + ''.join(circ(0, -90 + i*30, 6, INK, 0) for i in range(6)))
    t = g(body, 'translate(212,330) rotate(-32)')
    t += note(330, 300, 1.2, m) + note(380, 220, 1.0, tint(m, .2)) + note(322, 150, .9, m)
    t += L('M300,370 Q350,330 420,350 M310,410 Q370,380 430,400', sw=5, color=m)
    t += sparkle(100, 150, 11, m) + sparkle(392, 440, 9, m)
    return t

def c_big_cat(m):  # 美術班術科：比桌子大的貓
    t = path('M136,410 L344,410 L344,430 L136,430 Z', WOOD, 6) + L('M150,430 L146,540 M330,430 L334,540', sw=10, color=WOOD) + L('M150,430 L146,540 M330,430 L334,540', sw=3)
    t += g(rect(-170, -170, 340, 300, PAPER, rx=4), 'translate(240,280) rotate(-4)')
    cat = (path('M-120,40 C-130,-60 -60,-90 0,-90 C60,-90 130,-60 120,40 C110,90 -110,90 -120,40 Z', '#E9A04A', 6) +
           path('M-94,-62 L-80,-130 L-36,-86 Z M94,-62 L80,-130 L36,-86 Z', '#E9A04A', 6) +
           L('M-60,-30 l30,6 M60,-30 l-30,6 M-150,10 l60,6 M150,10 l-60,6 M-148,34 l58,-4 M148,34 l-58,-4', sw=5) +
           path('M-10,0 L10,0 L0,12 Z', '#D9453B', 4) + L('M-70,-60 l14,24 M-40,-74 l8,26 M70,-60 l-14,24', sw=6, color='#C9802F') +
           L('M120,40 C170,20 180,-40 150,-70', sw=14, color='#E9A04A') + L('M120,40 C170,20 180,-40 150,-70', sw=3))
    t += g(cat, 'translate(236,300) rotate(-4) scale(1.12)')
    t += g(rect(0, -9, 120, 18, m, rx=4, sw=5) + path('M120,-9 L150,0 L120,9 Z', m, 5), 'translate(300,470) rotate(-20)')
    t += sparkle(80, 120, 12, m) + sparkle(410, 104, 10, m)
    return t

def c_chore_chart(m):  # 冰箱上的家事表＋垃圾車音樂
    t = rect(90, 70, 220, 460, tint(m, .62), rx=20) + L('M90,230 L310,230', sw=6) + L('M286,110 L286,190 M286,260 L286,360', sw=10)
    t += g(rect(-70, -80, 140, 160, '#FFFDF4', rx=3, sw=5) + ''.join(L(f'M-56,{-52+i*32} L56,{-52+i*32}', sw=3, color=GREY) for i in range(4)) +
           L('M-20,-80 L-20,80 M20,-80 L20,80', sw=3, color=GREY) +
           ''.join(L(f'M{x-8},{y} l6,7 l12,-14', sw=5, color=m) for (x, y) in ((0, -66), (40, -34), (0, -2), (40, 30), (0, 62))) +
           circ(0, -84, 13, m, 5), 'translate(190,370) rotate(4)')
    t += g(path('M-46,-10 Q-50,60 0,70 Q50,60 46,-10 Q30,-30 0,-30 Q-30,-30 -46,-10 Z', '#4D5A6A', 6) + L('M-14,-30 l-12,-26 M14,-30 l12,-26', sw=6), 'translate(380,452) rotate(10)')
    t += L('M318,520 l-40,-6 M326,500 l-46,-14', sw=5, color=m)
    t += note(360, 260, 1.0, m) + note(410, 200, .85, m) + note(352, 150, .75, tint(m, .2))
    return t

def c_night_market(m):  # 夜市的攤位
    t = path('M54,100 Q240,70 426,104 L426,520 L54,520 Z', tint(shade(m, .55), .12), 0)
    t += L('M240,60 L240,148', sw=5)
    for r, op in ((120, .18), (84, .3)): t += circ(240, 196, r, '#FFE59A', 0).replace('filter', f'opacity="{op}" filter')
    t += path('M224,148 L256,148 L256,162 L224,162 Z', GREY, 5) + path('M240,162 C200,170 204,220 226,234 L254,234 C276,220 280,170 240,162 Z', '#FFF3B0', 6)
    t += L('M222,206 Q220,186 232,176', sw=5, color='#FFFFFF')
    for a in (-60, -30, 0, 30, 60):
        r = math.radians(a + 90); t += L(f'M{240+70*math.cos(r):.0f},{196+70*math.sin(r)+0:.0f} l{18*math.cos(r):.0f},{18*math.sin(r):.0f}', sw=5, color='#FFE59A') if False else ''
    for a in (200, 240, 300, 340, 160, 20):
        r = math.radians(a); t += L(f'M{240+62*math.cos(r):.0f},{196+62*math.sin(r):.0f} l{20*math.cos(r):.0f},{20*math.sin(r):.0f}', sw=5, color='#FFE59A')
    t += rect(60, 360, 360, 30, m, rx=4) + rect(72, 390, 336, 140, shade(m, .2), rx=4)
    t += g(path('M-80,-30 L80,-30 L86,30 L-74,30 Z', PAPER, 6) + L('M3,-30 L5,30', sw=4) + ''.join(L(f'M-66,{-14+i*14} l56,0 M20,{-14+i*14} l50,0', sw=3, color=GREY) for i in range(3)), 'translate(170,330) rotate(-6)')
    t += g(rect(-14, -50, 26, 12, 'none', sw=0), 'translate(0,0)')
    for i in range(4): t += ell(330, 350 - i*11, 30, 9, '#E2B13C', 5)
    t += circ(386, 344, 14, '#D0D0C8', 5)
    return t

def c_private_exam(m):  # 私中入學考：想著午餐
    t = path('M60,380 L420,350 L440,540 L40,560 Z', WOOD, SW)
    t += path('M100,380 L380,360 L392,520 L108,536 Z', PAPER, 6)
    for i in range(5):
        y = 396 + i*26
        t += L(f'M{122+i*0.6},{y+4-i*1.6} l140,-10', sw=4, color=GREY) + circ(318, y - 8 - i*1.8, 8, 'none', 4)
    t += g(rect(0, -10, 150, 20, '#E9B949', rx=3, sw=5) + path('M150,-10 L176,0 L150,10 Z', '#F1D9A8', 5), 'translate(250,500) rotate(-30)')
    t += circ(160, 320, 9, '#FFFFFF', 4) + circ(190, 280, 14, '#FFFFFF', 5)
    t += path('M190,250 C120,250 110,180 160,160 C160,100 250,80 280,120 C330,90 410,130 390,190 C430,220 400,270 350,262 C320,290 230,290 190,250 Z', '#FFFFFF', SW)
    t += g(rect(-80, -44, 160, 88, m, rx=10, sw=6) + rect(-70, -34, 140, 68, '#FFFDF4', rx=6, sw=4) + circ(-36, 0, 22, '#F7F5EE', 0) +
           ell(-36, 0, 16, 14, '#F2C94C', 3) + L('M2,-30 L2,30', sw=4) + rect(14, -24, 48, 20, '#6FA95C', rx=6, sw=3) + rect(18, 6, 40, 18, '#C9653A', rx=6, sw=3),
           'translate(262,184) rotate(-4)')
    return t

def c_math_helper(m):  # 數學小老師：排隊問題目
    t = rect(70, 90, 340, 150, '#2F4A3E', rx=6) + rect(70, 90, 340, 150, 'none', rx=6, sw=0)
    t += L('M110,200 L150,130 L190,200 Z', sw=5, color='#EDEBE3') + L('M222,166 a26,26 0 1 0 52,0 a26,26 0 1 0 -52,0', sw=5, color='#EDEBE3') + L('M308,130 L370,130 L370,192 L308,192 Z M308,192 L370,130', sw=5, color='#EDEBE3')
    t += rect(80, 420, 200, 22, WOOD, rx=4) + L('M96,442 L92,540 M264,442 L268,540', sw=8, color=WOOD)
    t += kid(180, 470, .84, m, 'hold') if False else kid(178, 470, .86, m, 'sit')
    t += g(rect(-34, -10, 68, 18, PAPER, rx=2, sw=5), 'translate(176,412) rotate(-4)')
    for i, (x, c) in enumerate([(304, '#E07A5F'), (348, '#6FA95C'), (392, '#E9B949')]):
        t += kid(x, 546, .58, c, 'stand')
    t += path('M330,380 C330,356 370,356 370,380 C370,404 330,404 330,380 Z', '#FFFFFF', 4) + L('M340,390 L350,370 L360,390 Z', sw=4, color=m)
    return t

def c_yearbook(m):  # 畢業紀念冊
    t = path('M70,170 L240,190 L410,166 L414,470 L240,494 L66,470 Z', m, SW)
    t += path('M84,184 L238,204 L238,474 L80,456 Z', PAPER) + path('M242,204 L396,180 L400,452 L242,474 Z', PAPER)
    blocks = [(100, 220, '#E07A5F', -6), (160, 300, '#3A7DC0', 4), (100, 380, '#8A4FA0', -3), (262, 214, '#E9A04A', 5), (310, 300, '#4E9E52', -5), (262, 380, '#D9453B', 3)]
    for x, y, c, r in blocks:
        t += g(L('M0,0 c10,-14 18,10 28,-4 s12,12 22,-2 s10,8 20,0', sw=5, color=c) + L('M4,22 c10,-10 18,8 28,-2 s12,10 20,0', sw=5, color=c), f'translate({x},{y}) rotate({r})')
    t += path('M190,250 c-10,-16 -32,-4 -18,12 l18,16 l18,-16 c14,-16 -8,-28 -18,-12 Z', '#E07A9A', 4)
    t += path('M356,404 l6,14 l15,1 l-12,9 l4,15 l-13,-8 l-13,8 l4,-15 l-12,-9 l15,-1 Z', '#F2C94C', 4)
    t += g(path('M-18,30 L-32,96 L-14,84 L-4,100 L4,30 Z M18,30 L32,96 L14,84 L4,100 L-4,30 Z', RED, 5) +
           ''.join(circ(26*math.cos(math.radians(a)), 26*math.sin(math.radians(a)), 18, '#E8504A', 5) for a in range(0, 360, 60)) + circ(0, 0, 16, '#F2C94C', 5),
           'translate(368,156) rotate(16)')
    return t

def c_netcafe(m):  # 第一次去網咖
    t = path('M54,80 Q240,56 426,84 L430,530 L50,530 Z', shade(m, .55), 0)
    t += rect(330, 100, 80, 90, '#24302A', rx=4, sw=5) + path('M378,128 a20,20 0 1 0 16,30 a16,16 0 1 1 -16,-30 Z', '#F4E3A1', 0)
    t += circ(240, 280, 150, tint(m, .5), 0).replace('filter', 'opacity=".25" filter')
    t += rect(130, 190, 220, 170, '#2A2E2A', rx=12) + rect(146, 204, 188, 138, tint(m, .4), rx=8, sw=4)
    t += rect(166, 224, 50, 40, '#F2C94C', rx=4, sw=0) + rect(230, 290, 80, 30, '#E07A5F', rx=4, sw=0) + circ(280, 240, 14, '#FFFFFF', 0)
    t += path('M200,360 L280,360 L290,384 L190,384 Z', '#2A2E2A', 5)
    t += path('M70,400 L410,400 L410,422 L70,422 Z', '#5B4636', 6)
    t += kid(240, 560, 1.0, shade(m, .1), 'stand', back=True)
    t += rect(176, 486, 128, 90, '#5B4636', rx=16)
    t += L('M206,412 q34,-70 68,0', sw=9, color='#3B3330') + rect(196, 400, 20, 30, '#D9453B', rx=6, sw=4) + rect(264, 400, 20, 30, '#D9453B', rx=6, sw=4)
    t += rect(360, 352, 32, 48, '#F4EEE0', rx=4, sw=5) + L('M384,352 L394,320', sw=5)
    return t

def c_track_dawn(m):  # 田徑隊晨練
    t = path('M60,100 Q240,70 420,104 L420,330 L60,330 Z', '#F6D9C8', 0)
    t += path('M150,330 a90,90 0 0 1 180,0 Z', '#F2A86A', 6) + L('M240,206 l0,-30 M170,232 l-20,-20 M310,232 l20,-20 M126,300 l-26,-6 M354,300 l26,-6', sw=5, color='#E9A04A')
    t += path('M40,330 L440,330 L440,560 L40,560 Z', m, 0)
    for i in range(4):
        t += L(f'M{40},{350+i*40+i*i*6} Q240,{330+i*30} 440,{340+i*48}', sw=5, color=PAPER)
    shoe = (path('M-100,22 L-98,-44 Q-94,-66 -64,-64 L-26,-62 Q-10,-30 20,-26 L80,-12 Q114,-2 112,22 Z', PAPER, SW) +
            path('M60,-16 L80,-12 Q114,-2 112,22 L60,22 Q50,0 60,-16 Z', tint(m, .35), 5) +
            path('M-98,-30 L-60,-30 L-56,22 L-100,22 Z', tint(m, .35), 5) +
            L('M-22,-52 l26,8 M-14,-42 l26,8 M-6,-34 l24,8 M-22,-52 l14,-14 M-6,-34 l18,-16', sw=4) +
            rect(-106, 20, 224, 22, m, rx=10, sw=6))
    t += g(shoe, 'translate(250,466) rotate(-8) scale(1.25)')
    t += L('M120,470 l-50,0 M130,496 l-60,4', sw=5, color=PAPER)
    return t

def c_inline_skate(m):  # 直排輪
    t = ''
    for i, op in enumerate((.18, .3, .45)):
        t += S(f'<ellipse cx="240" cy="470" rx="{190-i*40}" ry="{60-i*12}" {{a}}/>', 'none', 5, ink=m).replace('filter', f'opacity="{op}" filter')
    sk = (path('M-80,40 L-70,-120 Q-60,-150 -20,-150 L30,-150 Q46,-120 40,-80 L80,-40 Q110,-20 106,24 L104,40 Z', m, SW) +
          path('M-74,-80 L36,-80', 'none', 5) + L('M-30,-130 l40,0 M-34,-106 l44,0 M-30,-58 l40,8', sw=5, color=PAPER) +
          path('M-90,40 L114,40 L110,60 L-86,60 Z', GREY, 5) +
          ''.join(circ(-62 + i*50, 82, 22, '#F2C94C', 6) + circ(-62 + i*50, 82, 6, INK, 0) for i in range(4)))
    t += g(sk, 'translate(240,330) rotate(-8)')
    t += L('M76,400 l-36,0 M80,428 l-44,6 M90,370 l-30,-6', sw=5, color=m)
    t += sparkle(400, 170, 12, m) + sparkle(110, 180, 9, m)
    return t

def c_stage(m):  # 畢業典禮的表演
    t = rect(60, 80, 360, 380, shade(m, .45), rx=0, sw=0)
    t += path('M240,80 L150,460 L330,460 Z', '#FFF3B0', 0).replace('filter', 'opacity=".55" filter')
    t += path('M50,70 L150,70 C130,200 150,330 110,470 L50,470 Z', m, SW) + path('M430,70 L330,70 C350,200 330,330 370,470 L430,470 Z', m, SW)
    t += path('M40,60 L440,60 L440,104 Q400,128 360,104 Q320,128 280,104 Q240,128 200,104 Q160,128 120,104 Q80,128 40,104 Z', tint(m, .15), SW)
    t += path('M30,460 L450,460 L450,520 L30,520 Z', WOOD, SW)
    t += ell(240, 462, 70, 12, '#FFF3B0', 0)
    t += kid(240, 460, 1.0, '#F2F0EA', 'raise')
    t += sparkle(176, 220, 12, '#F2C94C') + sparkle(318, 200, 14, '#F2C94C') + sparkle(300, 290, 8, '#F2C94C')
    return t

def c_newspaper(m):  # 登上國語日報：冰箱上的剪報
    t = rect(80, 60, 320, 500, tint(m, .7), rx=24) + L('M110,170 L110,300', sw=10)
    clip = (path('M-110,-140 L110,-140 L104,-60 L112,30 L106,140 L-108,140 L-112,40 L-106,-50 Z', '#F1E3BD', SW) +
            rect(-92, -122, 184, 30, tint(m, .25), rx=3, sw=0) +
            rect(-92, -78, 80, 70, tint(m, .55), rx=3, sw=4) + path('M-86,-16 L-60,-50 L-40,-30 L-24,-48 L-18,-16 Z', m, 0) +
            ''.join(L(f'M4,{-74+i*18} l86,0', sw=4, color=GREY) for i in range(4)) +
            ''.join(L(f'M-92,{10+i*20} l{184 if i % 3 != 2 else 120},0', sw=4, color=GREY) for i in range(6)))
    t += g(clip, 'translate(250,320) rotate(5)')
    t += g(rect(-40, -12, 80, 24, '#E8D29B', rx=2, sw=0).replace('filter', 'opacity=".85" filter'), 'translate(160,188) rotate(-30)')
    t += g(rect(-40, -12, 80, 24, '#E8D29B', rx=2, sw=0).replace('filter', 'opacity=".85" filter'), 'translate(350,470) rotate(-28)')
    t += circ(330, 176, 22, m, 6) + circ(330, 176, 8, tint(m, .5), 0)
    t += sparkle(420, 120, 12, m) + sparkle(70, 520, 9, m)
    return t

def c_griddle(m):  # 早餐店的鐵板
    t = path('M54,80 Q240,56 426,86 L426,250 L54,250 Z', '#3D4A63', 0)
    t += path('M370,120 a24,24 0 1 0 18,34 a18,18 0 1 1 -18,-34 Z', '#F4E3A1', 0) + sparkle(120, 130, 8, '#F4E3A1') + sparkle(220, 110, 6, '#F4E3A1')
    t += path('M60,300 L420,300 L452,440 L28,440 Z', '#5A5550', SW) + path('M28,440 L452,440 L452,470 L28,470 Z', m, SW)
    t += L('M44,500 L36,560 M436,500 L444,560', sw=10, color=GREY)
    for (x, y) in ((170, 360), (300, 350)):
        t += path(f'M{x-60},{y} C{x-60},{y-40} {x-10},{y-36} {x},{y-30} C{x+40},{y-44} {x+66},{y-10} {x+50},{y+16} C{x+30},{y+40} {x-50},{y+36} {x-60},{y} Z', '#FFFFFF', 6)
        t += circ(x - 4, y - 2, 20, '#F2B630', 5)
    t += g(rect(0, -20, 90, 40, '#C9C6BE', rx=4, sw=6) + rect(90, -6, 110, 12, '#7A4E2D', rx=5, sw=5), 'translate(330,420) rotate(-30)')
    t += L('M140,290 q-16,-24 0,-48 t0,-48 M300,280 q-16,-24 0,-48 t0,-48 M230,290 q-12,-20 0,-40', sw=6, color='#F0EDE6')
    return t

def c_new_year(m):  # 過年的客廳
    t = path('M40,400 L440,400 L420,450 L60,450 Z', '#8A4B2E', SW) + L('M80,450 L80,540 M400,450 L400,540', sw=12, color='#8A4B2E') + L('M80,450 L80,540 M400,450 L400,540', sw=3)
    t += g(path('M-60,-20 C-70,60 70,60 60,-20 Q0,-36 -60,-20 Z', tint(m, .15), SW) + path('M-30,-28 Q0,-46 30,-28', 'none', 6) + circ(0, -40, 9, tint(m, .15), 5) +
           path('M58,0 C90,-10 100,-30 104,-50', 'none', 9) + path('M-60,0 C-104,-6 -100,50 -54,34', 'none', 8), 'translate(170,340)')
    t += path('M276,350 L320,350 L314,392 L282,392 Z', '#FFFFFF', 6) + ell(298, 352, 22, 6, '#C08A3E', 0)
    t += path('M336,360 L372,360 L368,394 L340,394 Z', '#FFFFFF', 6)
    t += ell(110, 398, 60, 10, '#E8E4D8', 5)
    for (x, y) in ((88, 380), (124, 382), (106, 356)): t += circ(x, y, 18, '#F29A2E', 5) + L(f'M{x},{y-18} l4,-6', sw=4, color='#4E9E52')
    t += g(rect(-40, -60, 80, 120, RED, rx=6) + path('M-40,-30 Q0,-6 40,-30', 'none', 5) + circ(0, -8, 16, '#F2C94C', 5), 'translate(300,196) rotate(12)')
    t += sparkle(180, 170, 12, m) + sparkle(420, 120, 10, '#F2C94C')
    t += g(rect(-34, -50, 68, 100, RED, rx=6) + path('M-34,-26 Q0,-6 34,-26', 'none', 5) + circ(0, -6, 13, '#F2C94C', 5), 'translate(366,246) rotate(-10)')
    return t

CARDS = [
    ('mem_06_study_a',    '#3A6FB0', c_contact_book,  -3, '攤開的聯絡簿：紅筆圈重點、家長簽名的鬼畫符、鉛筆'),
    ('mem_06_study_b',    '#2B8C96', c_homework_first, 2, '後面的舊電視在播片頭（彩虹＋音符），前面的習作只剩最後一格'),
    ('mem_06_play_a',     '#4A7038', c_recess,        -2, '盪鞦韆盪到最高＋旁邊在鬼抓人的小孩'),
    ('mem_06_play_b',     '#2E6E5A', c_dusk_slide,     3, '天黑的公園溜滑梯，月亮出來了，左邊傳來叫名字的聲波'),
    ('mem_06_exercise_a', '#A8322D', c_training_wheel,-3, '紅色小腳踏車，拆下來的輔助輪滾在地上，飄著一張 OK 繃'),
    ('mem_06_exercise_b', '#C8572B', c_jump_rope,      2, '跳繩跳到騰空，殘影繩子一圈又一圈'),
    ('mem_06_talent_a',   '#6B4A8C', c_metronome,     -2, '擺動的節拍器＋底下一排琴鍵'),
    ('mem_06_talent_b',   '#9A4DA6', c_crayons,        3, '打開的蠟筆盒（七色）＋後面一張塗鴉（太陽、草、房子）'),
    ('mem_06_work_a',     '#B8902F', c_shop_stool,    -2, '店面條紋遮雨棚下，坐在紅色塑膠小板凳上揮手的小孩'),
    ('mem_06_work_b',     '#A6742B', c_key_ricecooker, 2, '掛繩鑰匙＋冒蒸氣的電鍋（無商標）'),
    ('mem_09_study_a',    '#4A5DB5', c_after_school,  -2, '戴黃帽的路隊三個小孩，走向安親班的門（招牌空白）'),
    ('mem_09_study_b',    '#2C7DB8', c_library_card,   3, '書袋插著借書卡，卡上一整排一樣的簽名線'),
    ('mem_09_play_a',     '#6E8B2A', c_trading_cards, -3, '從木頭抽屜扇出來的四張卡牌（星星、圓、火焰、閃電）'),
    ('mem_09_play_b',     '#3C8A5A', c_computer_class, 2, '米色 CRT 電腦螢幕一半是方塊小遊戲、一半瞬間切回白色文件'),
    ('mem_09_exercise_a', '#B8402E', c_dodgeball,     -2, '躲避球場只剩一個小孩跳起來閃球，場外一圈歡呼手'),
    ('mem_09_exercise_b', '#C9692A', c_alley_hoop,     3, '黃昏巷口，沒有網子的籃框、飛過去的籃球、路燈'),
    ('mem_09_talent_a',   '#5A4E9E', c_recorder,      -3, '米色直笛斜放，笛口飄出一串音符'),
    ('mem_09_talent_b',   '#A04A86', c_big_cat,        2, '比桌子還大的一張貓（橘貓）畫紙＋畫筆'),
    ('mem_09_work_a',     '#C49A1E', c_chore_chart,   -2, '冰箱上的打勾家事表、一袋垃圾、垃圾車音符'),
    ('mem_09_work_b',     '#C27A1F', c_night_market,   3, '夜市攤子上一顆熱燈泡，下面攤開的作業簿和一疊零錢'),
    ('mem_12_study_a',    '#34507F', c_private_exam,  -2, '考卷＋鉛筆，頭上冒出想像泡泡：便當'),
    ('mem_12_study_b',    '#3F95B5', c_math_helper,    2, '黑板畫三角形和圓、坐在桌前的小老師，旁邊排隊的同學'),
    ('mem_12_play_a',     '#7A9A3A', c_yearbook,      -3, '畢業紀念冊寫滿彩色留言塗鴉，角落別一朵畢業胸花'),
    ('mem_12_play_b',     '#2E5A3A', c_netcafe,        2, '暗暗的網咖、發亮的螢幕、背對的小孩戴耳機，窗外已有月亮'),
    ('mem_12_exercise_a', '#9A2F45', c_track_dawn,    -2, '日出的紅色跑道，前景一隻跑鞋'),
    ('mem_12_exercise_b', '#D24A3A', c_inline_skate,   3, '直排輪鞋，後面繞圈的軌跡'),
    ('mem_12_talent_a',   '#7A3F7A', c_stage,         -2, '布幕舞台、聚光燈下舉手的小孩'),
    ('mem_12_talent_b',   '#574A7A', c_newspaper,      3, '冰箱門上用膠帶貼著泛黃的剪報（只有線條，沒有字）'),
    ('mem_12_work_a',     '#A88A2A', c_griddle,       -2, '天還沒亮，早餐店鐵板上兩顆荷包蛋、鍋鏟、蒸氣'),
    ('mem_12_work_b',     '#B5682A', c_new_year,       2, '過年茶几：茶壺茶杯、一盤橘子、紅包（素面）'),
]

DEFS = '''<defs>
 <filter id="wl" filterUnits="userSpaceOnUse" x="-1200" y="-1200" width="2880" height="3000"><feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="2" seed="{s1}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G"/></filter>
 <filter id="wf" filterUnits="userSpaceOnUse" x="-1200" y="-1200" width="2880" height="3000"><feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="{s2}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="11" xChannelSelector="G" yChannelSelector="R" result="d"/><feTranslate dx="3" dy="2"/></filter>
 <filter id="blob" filterUnits="userSpaceOnUse" x="0" y="0" width="480" height="600"><feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="{s3}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="40" xChannelSelector="R" yChannelSelector="G"/></filter>
 <filter id="grain" filterUnits="userSpaceOnUse" x="0" y="0" width="480" height="600"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3" seed="{s4}"/><feColorMatrix values="0 0 0 0 .2  0 0 0 0 .19  0 0 0 0 .17  0 0 0 .13 0"/></filter>
 <filter id="crayon" filterUnits="userSpaceOnUse" x="0" y="0" width="480" height="600"><feTurbulence type="fractalNoise" baseFrequency=".5 .06" numOctaves="2" seed="{s5}" result="t"/><feColorMatrix in="t" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -1.6 1.15" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter>
</defs>'''

def card_svg(cid, main, fn, tilt, seed):
    feat = fn(main)
    blob_rot = -tilt * 1.5
    bg = (f'<rect width="{W}" height="{H}" fill="{PAPER}"/>'
          f'<g filter="url(#crayon)"><g filter="url(#blob)"><rect x="52" y="64" width="376" height="472" rx="90" fill="{tint(main, .72)}" transform="rotate({blob_rot} 240 300)"/></g></g>'
          f'<g filter="url(#blob)" opacity=".5"><circle cx="{110 if tilt > 0 else 380}" cy="{120 if tilt > 0 else 500}" r="34" fill="{tint(main, .5)}"/></g>')
    body = f'<g transform="rotate({tilt} 240 300)">{feat}</g>'
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">'
           f'<!-- 《台灣人生》童年記憶牌插圖 {cid}｜主色 {main}｜art/deck/memory/src/gen_memory.py 產生，請改產生器不要手改 -->'
           + DEFS.format(s1=seed, s2=seed + 7, s3=seed + 13, s4=seed + 21, s5=seed + 29) + bg + body +
           f'<rect width="{W}" height="{H}" filter="url(#grain)"/></svg>')
    assert '<text' not in svg and '<tspan' not in svg, cid
    return svg

def main():
    os.makedirs(OUT, exist_ok=True)
    data_path = os.path.join(HERE, '..', '..', '..', '..', 'data', 'deck', 'childhood.json')
    ids = None
    if os.path.exists(data_path):
        ids = [x['id'] for x in json.load(open(data_path, encoding='utf-8'))['memories']]
    mine = [c[0] for c in CARDS]
    if ids is not None and sorted(ids) != sorted(mine):
        print('⚠️ childhood.json 的 id 跟產生器不一致：', set(ids) ^ set(mine)); sys.exit(1)
    man = {'_note': '童年記憶牌插圖（美術設計）。4:5 母版 480×600，主體在安全區 x 80–400、y 60–540。svg＝向量原檔（含濾鏡），png＝600×750 匯出（96 色調色盤，遊戲建議用 png）。', 'ratio': '4:5', 'size': [W, H], 'safe_zone': [80, 60, 400, 540], 'cards': {}}
    for i, (cid, main_c, fn, tilt, subj) in enumerate(CARDS):
        open(os.path.join(OUT, cid + '.svg'), 'w', encoding='utf-8').write(card_svg(cid, main_c, fn, tilt, 11 + i * 3))
        man['cards'][cid] = {'svg': f'art/deck/memory/{cid}.svg', 'png': f'art/deck/memory/{cid}.png', 'accent': main_c, 'subject': subj}
    json.dump(man, open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('wrote', len(CARDS))

if __name__ == '__main__':
    main()
