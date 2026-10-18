#!/usr/bin/env python3
"""時代牌舊電視框（美術設計）。輸出 art/deck/era/tv-frame.svg：1280×720，疊在牌圖上面。
螢幕挖空（透明），外框顏色吃 CSS 變數 --acc（沒有就用木頭色 #8A5A3C）。
圖裡沒有文字、數字、商標。ID 一律加 tvf- 前綴，內嵌到 DOM 不會跟別的 SVG 撞名。"""
import os
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.abspath(os.path.join(HERE, '..'))
W, H = 1280, 720
INK = '#33302B'; PAPER = '#FBFAF6'; CREAM = '#EFE6D2'
FB = '#8A5A3C'  # --acc 的備用色（木頭）
ACC = f'var(--acc, {FB})'
def acc_mix(pct, other):  # color-mix：沒支援的瀏覽器會退回描述在 fill 屬性上的備用色
    return f'color-mix(in srgb, {ACC} {pct}%, {other})'

# 螢幕（CRT 鼓起的圓角）
SX0, SY0, SX1, SY1, R = 104, 136, 1000, 652, 70
def crt(x0, y0, x1, y1, r, bulge):
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    return (f'M{x0+r},{y0} Q{cx},{y0-bulge} {x1-r},{y0} Q{x1},{y0} {x1},{y0+r} Q{x1+bulge},{cy} {x1},{y1-r} '
            f'Q{x1},{y1} {x1-r},{y1} Q{cx},{y1+bulge} {x0+r},{y1} Q{x0},{y1} {x0},{y1-r} Q{x0-bulge},{cy} {x0},{y0+r} Q{x0},{y0} {x0+r},{y0} Z')
SCREEN = crt(SX0, SY0, SX1, SY1, R, 14)
BEZEL = crt(SX0 - 30, SY0 - 30, SX1 + 30, SY1 + 30, R + 26, 16)
CAB = 'M100,66 L1180,64 Q1246,66 1248,130 L1250,628 Q1248,690 1184,692 L96,694 Q32,692 32,628 L30,132 Q32,68 100,66 Z'
FULL = f'M0,0 H{W} V{H} H0 Z'

def ink(d, w=14, extra=''):
    return f'<path d="{d}" fill="none" stroke="{INK}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round" filter="url(#tvf-wl)"{extra}/>'

knobs = ''
for cy, rot in ((236, -30), (370, 40)):
    ticks = ''.join(f'<path d="M1124,{cy-66} L1124,{cy-56}" transform="rotate({a} 1124 {cy})" stroke="{INK}" stroke-width="6" stroke-linecap="round" filter="url(#tvf-wl)"/>' for a in range(-120, 121, 40))
    knobs += (ticks + f'<circle cx="1124" cy="{cy}" r="46" fill="{CREAM}" filter="url(#tvf-wf)"/>' + ink(f'M1078,{cy} a46,46 0 1 0 92,0 a46,46 0 1 0 -92,0', 12) +
              f'<g transform="rotate({rot} 1124 {cy})">' + ink(f'M1124,{cy-34} L1124,{cy-8}', 10) + '</g>')
grille = ''.join(ink(f'M1068,{470+i*26} L1180,{468+i*26}', 9) for i in range(6))
wood = ''.join(f'<path d="{d}" fill="none" stroke="{INK}" stroke-opacity=".22" stroke-width="5" stroke-linecap="round" filter="url(#tvf-wl)"/>' for d in (
    'M80,96 C300,86 520,104 760,92 S1060,98 1200,94', 'M70,676 C320,668 600,684 880,672 S1120,680 1210,674',
    'M54,200 C60,320 48,460 58,600', 'M1220,160 C1214,300 1226,420 1216,600', 'M640,92 c40,-6 80,4 120,-2'))

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
<!-- 《台灣人生》時代牌舊電視框｜螢幕透明，牌圖墊在下面｜外框色＝var(--acc)｜art/deck/era/src/gen_tv_frame.py 產生，請改產生器不要手改 -->
<defs>
 <filter id="tvf-wl" filterUnits="userSpaceOnUse" x="-40" y="-40" width="{W+80}" height="{H+80}"><feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="5" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="12" xChannelSelector="R" yChannelSelector="G"/></filter>
 <filter id="tvf-wf" filterUnits="userSpaceOnUse" x="-40" y="-40" width="{W+80}" height="{H+80}"><feTurbulence type="fractalNoise" baseFrequency="0.01" numOctaves="2" seed="9" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="14" xChannelSelector="G" yChannelSelector="R"/></filter>
 <filter id="tvf-grain" filterUnits="userSpaceOnUse" x="0" y="0" width="{W}" height="{H}"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="3" seed="3"/><feColorMatrix values="0 0 0 0 .2  0 0 0 0 .19  0 0 0 0 .17  0 0 0 .16 0"/></filter>
 <radialGradient id="tvf-vig" cx="50%" cy="50%" r="62%"><stop offset=".62" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".42"/></radialGradient>
 <clipPath id="tvf-noscreen"><path clip-rule="evenodd" d="{FULL} {SCREEN}"/></clipPath>
 <clipPath id="tvf-screen"><path d="{SCREEN}"/></clipPath>
</defs>
<g clip-path="url(#tvf-noscreen)">
 <rect width="{W}" height="{H}" fill="{PAPER}" style="fill:var(--tv-paper, {PAPER})"/>
 <!-- 天線 -->
 <path d="M560,70 L424,22 M600,70 L740,18" fill="none" stroke="{INK}" stroke-width="10" stroke-linecap="round" filter="url(#tvf-wl)"/>
 <circle cx="424" cy="22" r="11" fill="{INK}"/><circle cx="740" cy="18" r="11" fill="{INK}"/>
 <path d="M528,76 Q580,30 632,76 Z" fill="{FB}" style="fill:{acc_mix(70, '#1E1B18')}" filter="url(#tvf-wf)"/>{ink('M528,76 Q580,30 632,76', 10)}
 <!-- 腳 -->
 <path d="M150,690 L176,716 L240,716 L252,690 Z M1030,690 L1042,716 L1106,716 L1132,690 Z" fill="{FB}" style="fill:{acc_mix(70, '#1E1B18')}" filter="url(#tvf-wf)"/>
 {ink('M150,690 L176,716 L240,716 L252,690 M1030,690 L1042,716 L1106,716 L1132,690', 10)}
 <!-- 機殼（外框色） -->
 <path fill-rule="evenodd" d="{CAB} {SCREEN}" fill="{FB}" style="fill:{ACC}" filter="url(#tvf-wf)"/>
 {wood}
 <!-- 右邊控制面板 -->
 <path d="M1046,120 L1206,118 L1208,642 L1048,644 Z" fill="#6B4A33" style="fill:{acc_mix(78, '#1E1B18')}" filter="url(#tvf-wf)"/>
 {ink('M1046,120 L1206,118 L1208,642 L1048,644 Z', 10)}
 {knobs}{grille}
 <circle cx="1084" cy="618" r="9" fill="#E05A3A"/>
 <!-- 螢幕外圈（深色鐵框） -->
 <path fill-rule="evenodd" d="{BEZEL} {SCREEN}" fill="#2B2622" style="fill:{acc_mix(35, '#1E1B18')}" filter="url(#tvf-wf)"/>
 {ink(BEZEL, 14)}
 {ink(CAB, 16)}
 <rect width="{W}" height="{H}" filter="url(#tvf-grain)"/>
</g>
<!-- 螢幕：透明，只加一點 CRT 暗角和反光 -->
<g clip-path="url(#tvf-screen)" pointer-events="none">
 <rect x="{SX0-20}" y="{SY0-20}" width="{SX1-SX0+40}" height="{SY1-SY0+40}" fill="url(#tvf-vig)"/>
 <path d="M170,250 Q190,180 290,170" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width="18" stroke-linecap="round"/>
 <path d="M168,300 L170,290" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="16" stroke-linecap="round"/>
</g>
{ink(SCREEN, 12)}
</svg>
'''
assert '<text' not in svg
open(os.path.join(OUT, 'tv-frame.svg'), 'w', encoding='utf-8').write(svg)
pct = lambda v, t: round(v / t * 100, 2)
print('screen hole (bbox) inset top/right/bottom/left %:', pct(SY0 - 14, H), pct(W - SX1 - 14, W), pct(H - SY1 - 14, H), pct(SX0 - 14, W))
print('screen inner (no bulge) inset %:', pct(SY0, H), pct(W - SX1, W), pct(H - SY1, H), pct(SX0, W))
