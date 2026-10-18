# v1.2 手機一屏版面 mockup 產生器（美術設計）。只產出 art/ui/mobile-v12/*.svg，不碰遊戲程式。
# 用法：python3 gen.py  → 產生 SVG；PNG 由 render.mjs 用 headless Chrome 轉出。
import json, math, os
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)
ROOT = os.path.abspath(os.path.join(OUT, '..', '..', '..'))
CARDS = {c['id']: c for c in json.load(open(os.path.join(ROOT, 'data/deck/cards.json')))['cards']}
IMG = lambda cid: f'../../deck/{cid}.jpg'
FONT_URL = '../../../game/public/fonts/jf-openhuninn-2.1.woff2'

BG, PAPER, INK, MUTED, RED, BOARD, CHALK, TAPE, NOTE = '#EDEFE8', '#FBFAF6', '#33302B', '#66615A', '#B0443A', '#2F4A3E', '#EDEBE3', '#E8D29B', '#A9C4D9'
STAT = [('academic', '學業', '#3E6FB0', 2), ('happiness', '快樂', '#B86E0E', 3), ('stress', '壓力', '#8A5BA8', 4),
        ('health', '健康', '#3D8A4B', 4), ('social', '關係', '#C24E76', 3), ('wealth', '家庭資源', '#967430', 1)]
SB_ICONS = {
'academic':'<path d="M3 6c3-1.5 6-1.2 9 .6 3-1.8 6-2.1 9-.6v12c-3-1.4-6-1.1-9 .6-3-1.7-6-2-9-.6z"/><path d="M12 6.6v12"/>',
'happiness':'<circle cx="12" cy="12" r="8.6"/><path d="M8.3 10h.1M15.6 10h.1M8 14.2c2.3 2.6 5.7 2.6 8 0"/>',
'stress':'<path d="M4 15c0-4 3.5-7 8-7s8 3 8 7z"/><path d="M7 15l-1 4M12 15v4.5M17 15l1 4M9 5l1.5 1.6M14.6 4.5 13.4 6.4"/>',
'health':'<path d="M12 20s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7.6 4.2 4.2 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/><path d="M8 12.5h2.2l1-2 1.7 4 1-2H16"/>',
'social':'<circle cx="8.5" cy="9" r="3"/><circle cx="16" cy="9.5" r="2.6"/><path d="M3.5 19c.6-3.4 2.7-5 5-5s4.4 1.6 5 5M13.5 15c.8-.9 1.7-1.3 2.6-1.3 2 0 3.7 1.6 4.2 4.6"/>',
'wealth':'<rect x="3.5" y="8" width="17" height="11" rx="2"/><path d="M8 8V6.3c0-1.1.9-2 2-2h4a2 2 0 0 1 2 2V8M3.5 12.5h17"/><circle cx="12" cy="14.6" r="1.3"/>'}

def esc(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
def darken(hexc, f):
    h = hexc.lstrip('#'); r, g, b = (int(h[i:i+2], 16) for i in (0, 2, 4))
    return '#%02X%02X%02X' % tuple(int(x * f) for x in (r, g, b))
def mix(hexc, other, t):
    a = [int(hexc.lstrip('#')[i:i+2], 16) for i in (0, 2, 4)]; b = [int(other.lstrip('#')[i:i+2], 16) for i in (0, 2, 4)]
    return '#%02X%02X%02X' % tuple(int(x * (1 - t) + y * t) for x, y in zip(a, b))

class S:
    """一張 SVG 畫布"""
    def __init__(self, w, h, safe_top, safe_bottom, title):
        self.w, self.h, self.st, self.sb, self.title = w, h, safe_top, safe_bottom, title
        self.parts = []; self.uid = 0
    def add(self, s): self.parts.append(s)
    def id(self, p='c'): self.uid += 1; return f'{p}{self.uid}'
    def svg(self):
        defs = f'''<defs>
<style>@font-face{{font-family:"jf-openhuninn";src:url("{FONT_URL}") format("woff2");}}
.h{{font-family:"jf-openhuninn","Noto Sans CJK TC","Noto Sans TC",sans-serif}}
.t{{font-family:"Noto Serif CJK TC","Noto Serif TC",serif;font-weight:700}}
.s{{font-family:"Noto Sans CJK TC","Noto Sans TC",sans-serif}}</style>
<filter id="rough" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="2.2"/></filter>
<filter id="roughBig" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="8"/><feDisplacementMap in="SourceGraphic" scale="3.5"/></filter>
<filter id="paper" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="5" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0.2  0 0 0 0 0.19  0 0 0 0 0.17  0 0 0 0.09 0"/></filter>
<filter id="sepia"><feColorMatrix type="matrix" values="0.36 0.45 0.12 0 0  0.31 0.40 0.10 0 0  0.25 0.32 0.08 0 0  0 0 0 1 0"/></filter>
<filter id="shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#3a3229" flood-opacity="0.22"/></filter>
<filter id="shadowHeavy" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="1" dy="6" stdDeviation="4" flood-color="#1d1915" flood-opacity="0.42"/></filter>
<pattern id="cloth" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 5h10M5 0v10" stroke="#ffffff" stroke-opacity="0.10" stroke-width="1.4"/><circle cx="5" cy="5" r="1.3" fill="#ffffff" fill-opacity="0.12"/></pattern>
<pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 4h8" stroke="{MUTED}" stroke-opacity="0.28" stroke-width="1.5"/></pattern>
<pattern id="lines" width="10" height="26" patternUnits="userSpaceOnUse"><path d="M0 25.5h10" stroke="{NOTE}" stroke-opacity="0.45" stroke-width="1"/></pattern>
</defs>'''
        base = f'<rect width="{self.w}" height="{self.h}" fill="{BG}"/>'
        noise = f'<rect width="{self.w}" height="{self.h}" filter="url(#paper)" pointer-events="none"/>'
        safe = ''
        if self.st: safe += f'<rect width="{self.w}" height="{self.st}" fill="url(#hatch)"/><text x="{self.w/2}" y="{self.st/2+5}" text-anchor="middle" class="s" font-size="11" fill="{MUTED}">安全區（瀏海／狀態列）</text>'
        if self.sb: safe += f'<rect y="{self.h-self.sb}" width="{self.w}" height="{self.sb}" fill="url(#hatch)"/><rect x="{self.w/2-67}" y="{self.h-13}" width="134" height="5" rx="2.5" fill="{INK}" opacity=".6"/><text x="12" y="{self.h-self.sb/2+4}" class="s" font-size="11" fill="{MUTED}">安全區（Home 指示條）</text>'
        return (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}">'
                f'<title>{esc(self.title)}</title>{defs}{base}' + ''.join(self.parts) + noise + safe + '</svg>')

# ---------- 小元件 ----------
def clock(x, y, r, on=True, col=BOARD):
    """時間格：手繪時鐘，沒有刻度數字。用掉的 = 灰色虛線＋打叉"""
    if on:
        return (f'<g filter="url(#rough)"><circle cx="{x}" cy="{y}" r="{r}" fill="{TAPE}" stroke="{col}" stroke-width="2"/>'
                f'<path d="M{x} {y}V{y-r*0.6}M{x} {y}L{x+r*0.45} {y+r*0.2}" stroke="{col}" stroke-width="2" stroke-linecap="round"/>'
                f'<path d="M{x-r*0.55} {y-r-1.5}l-2 -2M{x+r*0.55} {y-r-1.5}l2 -2" stroke="{col}" stroke-width="1.8" stroke-linecap="round"/></g>')
    return (f'<g filter="url(#rough)" opacity=".55"><circle cx="{x}" cy="{y}" r="{r}" fill="none" stroke="{MUTED}" stroke-width="1.6" stroke-dasharray="3 2.5"/>'
            f'<path d="M{x-r*0.6} {y-r*0.6}L{x+r*0.6} {y+r*0.6}" stroke="{MUTED}" stroke-width="1.6" stroke-linecap="round"/></g>')

def semester(x, y, which):
    """學期：兩本小課本，上學期亮左本、下學期兩本都亮（第二本畫上書籤）"""
    out = []
    for i in range(2):
        on = i == 0 or which == 2
        bx = x + i * 17
        fill = TAPE if on else 'none'
        stroke = CHALK
        out.append(f'<g filter="url(#rough)"><path d="M{bx} {y}h12v15h-12z" fill="{fill}" stroke="{stroke}" stroke-width="1.6" {"" if on else "stroke-dasharray=\"2.5 2\""}/>'
                   f'<path d="M{bx+3} {y}v15" stroke="{stroke if not on else BOARD}" stroke-width="1.2" opacity=".7"/></g>')
    if which == 2:
        out.append(f'<path d="M{x+17+8} {y-2}v9l2-2 2 2v-9z" fill="{RED}"/>')
    return ''.join(out)

def topbar(s, y, h, stage='高中', years_done=2, years_total=3, sem=2, county='臺南市'):
    """左：黑板色階段牌（階段字＋年份圓點＋學期課本）；右：選單鈕 44×44"""
    pill_w = 196
    o = [f'<g filter="url(#shadow)"><rect x="10" y="{y+4}" width="{pill_w}" height="{h-8}" rx="8" fill="{BOARD}"/></g>',
         f'<text x="22" y="{y+h/2+6}" class="t" font-size="17" fill="{CHALK}">{stage}</text>']
    for i in range(years_total):
        cx = 66 + i * 14; on = i < years_done
        o.append(f'<circle cx="{cx}" cy="{y+h/2}" r="4.6" fill="{CHALK if on else "none"}" stroke="{CHALK}" stroke-width="1.5" filter="url(#rough)"/>')
    o.append(semester(118, y + h/2 - 8, sem))
    o.append(f'<text x="158" y="{y+h/2+5}" class="h" font-size="13" fill="{CHALK}">{"下學期" if sem==2 else "上學期"}</text>')
    o.append(f'<text x="{s.w-62}" y="{y+h/2+5}" text-anchor="end" class="h" font-size="13" fill="{MUTED}">{county}</text>')
    bx = s.w - 54
    o.append(f'<g filter="url(#rough)"><rect x="{bx}" y="{y}" width="44" height="44" rx="10" fill="{PAPER}" stroke="{MUTED}" stroke-width="1.4"/>'
             f'<path d="M{bx+13} {y+16}h18M{bx+13} {y+22}h18M{bx+13} {y+28}h18" stroke="{INK}" stroke-width="2" stroke-linecap="round"/></g>')
    s.add(''.join(o))

def stats(s, y, h, danger='stress', compact=False):
    """六個屬性：圖示＋五格蠟筆條，沒有數字也沒有等級字（點整條 → 屬性詳情，才看到「偏弱」等文字）"""
    n = 6; pad = 10; cw = (s.w - pad*2) / n
    o = [f'<rect x="{pad-2}" y="{y}" width="{s.w-pad*2+4}" height="{h}" rx="10" fill="{PAPER}" stroke="{mix(MUTED,PAPER,.5)}" stroke-width="1" filter="url(#rough)"/>']
    for i, (k, name, col, lv) in enumerate(STAT):
        cx = pad + cw*i + cw/2
        isz = 18 if compact else 20
        dz = k == danger
        o.append(f'<g transform="translate({cx-isz/2},{y+4}) scale({isz/24})" fill="none" stroke="{"#D2452F" if dz else col}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">{SB_ICONS[k]}</g>')
        bw = cw - 16; seg = (bw - 4*2) / 5; by = y + h - 11
        for j in range(5):
            on = j < lv
            o.append(f'<rect x="{cx-bw/2 + j*(seg+2):.1f}" y="{by}" width="{seg:.1f}" height="6" rx="2" fill="{col if on else mix(col,PAPER,.82)}" filter="url(#rough)"/>')
        if dz:
            o.append(f'<ellipse cx="{cx}" cy="{y+h/2}" rx="{cw/2-3}" ry="{h/2-2}" fill="none" stroke="#D2452F" stroke-width="1.6" stroke-dasharray="4 3" filter="url(#roughBig)"/>')
    s.add(''.join(o))

def polaroid(s, x, y, w, cid, rot=-1.5, caption=None, img_h=None):
    img_h = img_h or w * 0.6
    clip = s.id('pc')
    pad = 7
    H = img_h + pad + (28 if caption else pad)
    o = [f'<g transform="rotate({rot} {x+w/2} {y+H/2})">',
         f'<g filter="url(#shadow)"><rect x="{x}" y="{y}" width="{w}" height="{H}" fill="{PAPER}" rx="2"/></g>',
         f'<clipPath id="{clip}"><rect x="{x+pad}" y="{y+pad}" width="{w-pad*2}" height="{img_h}"/></clipPath>',
         f'<image href="{IMG(cid)}" x="{x+pad}" y="{y+pad}" width="{w-pad*2}" height="{img_h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#{clip})"/>',
         f'<rect x="{x+w/2-26}" y="{y-8}" width="52" height="16" fill="{TAPE}" opacity=".85" transform="rotate(-4 {x+w/2} {y})"/>']
    if caption:
        o.append(f'<text x="{x+pad+2}" y="{y+pad+img_h+20}" class="h" font-size="13" fill="{MUTED}">{esc(caption)}</text>')
    o.append('</g>')
    s.add(''.join(o)); return H

def wrap(text, n):
    out, cur = [], ''
    for ch in text:
        cur += ch
        if len(cur) >= n and ch not in '，。、「」': out.append(cur); cur = ''
    if cur: out.append(cur)
    # 標點不放行首
    fixed = []
    for line in out:
        if fixed and line and line[0] in '，。、」': fixed[-1] += line[0]; line = line[1:]
        if line: fixed.append(line)
    return fixed

def textblock(s, x, y, text, size=15, n=20, lh=1.6, col=INK, cls='h', anchor='start'):
    lines = wrap(text, n)
    s.add(''.join(f'<text x="{x}" y="{y + i*size*lh:.1f}" class="{cls}" font-size="{size}" fill="{col}" text-anchor="{anchor}">{esc(l)}</text>' for i, l in enumerate(lines)))
    return len(lines) * size * lh

# ---------- 手牌 ----------
def action_card(s, x, y, w, h, cid, rot=0, lifted=False, small_title=13):
    c = CARDS[cid]; acc = c['accent']; clip = s.id('ac')
    pad = 5; art_h = round((w - pad*2) * 0.72)
    t = f'rotate({rot} {x+w/2} {y+h})'
    o = [f'<g transform="{t}">']
    if lifted:
        o.append(f'<rect x="{x-4}" y="{y-4}" width="{w+8}" height="{h+8}" rx="10" fill="{acc}" opacity=".25"/>')
    o += [f'<g filter="url(#shadow)"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="7" fill="{PAPER}"/></g>',
          f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="7" fill="none" stroke="{acc}" stroke-width="2.6" filter="url(#rough)"/>',
          f'<clipPath id="{clip}"><rect x="{x+pad}" y="{y+pad}" width="{w-pad*2}" height="{art_h}" rx="4"/></clipPath>',
          f'<rect x="{x+pad}" y="{y+pad}" width="{w-pad*2}" height="{art_h}" rx="4" fill="{mix(acc,PAPER,.85)}"/>',
          f'<image href="{IMG(cid)}" x="{x+pad - (w-pad*2)*0.12}" y="{y+pad}" width="{(w-pad*2)*1.24}" height="{art_h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#{clip})"/>']
    name = c['name']; ty = y + pad + art_h + 17
    lines = wrap(name, 5) if len(name) > 5 else [name]
    fs = small_title if len(name) <= 4 else small_title - 1
    for i, ln in enumerate(lines[:2]):
        o.append(f'<text x="{x+7}" y="{ty + i*15}" class="h" font-size="{fs}" font-weight="700" fill="{INK}">{esc(ln)}</text>')
    # 主色：標題下的蠟筆底線
    ul_y = ty + 4 + (len(lines[:2])-1)*15
    o.append(f'<path d="M{x+6} {ul_y}q{w*0.3} 3 {min(w-14, len(lines[0])*fs+4)} -1" stroke="{acc}" stroke-width="3" opacity=".55" fill="none" stroke-linecap="round"/>')
    # 時間成本：右下角小時鐘
    cost = c.get('cost') or 1
    for k in range(cost):
        o.append(clock(x + w - 11 - k*15, y + h - 11, 5.2, True, acc))
    if c.get('expires_age'):
        # 會過期：左下角的小沙漏（不寫幾歲）
        o.append(f'<path d="M{x+8} {y+h-17}h8l-8 10h8z" fill="none" stroke="{acc}" stroke-width="1.6" filter="url(#rough)"/>')
    o.append('</g>'); s.add(''.join(o))

def fuse(x, y, w, total, burned, scale=1.0, light=True):
    """引信：一段一段的繩子，燒掉的段變焦黑，火星在目前位置。沒有數字。"""
    seg = w / total; o = []
    for i in range(total):
        sx = x + i*seg; b = i < burned
        col = '#2A2522' if b else '#D9B77A'
        o.append(f'<path d="M{sx+1} {y}q{seg/2} {-3*scale} {seg-2} 0" stroke="{col}" stroke-width="{3.2*scale}" fill="none" stroke-linecap="round" {"stroke-dasharray=\"2 2\"" if b else ""}/>')
        if i < total - 1:
            o.append(f'<circle cx="{sx+seg}" cy="{y}" r="{2.1*scale}" fill="{"#2A2522" if b else "#B89656"}"/>')
    if 0 < burned < total + 1 and light:
        fx = x + burned*seg
        o.append(f'<g><circle cx="{fx}" cy="{y}" r="{4.6*scale}" fill="#F2B85A" opacity=".55"/><path d="M{fx} {y-6*scale}l{1.6*scale} {4.5*scale}l{3.4*scale} -1l-{2.4*scale} {3*scale}l{2.6*scale} {3*scale}l-{4*scale} -1.4l-{1.2*scale} {3.6*scale}l-{1.2*scale} -{3.6*scale}l-{4*scale} 1.4l{2.6*scale} -{3*scale}l-{2.4*scale} -{3*scale}l{3.4*scale} 1z" fill="#D2452F"/></g>')
    return ''.join(o)

def burden_card(s, x, y, w, h, cid, rot=0, total=3, burned=1, shaking=False):
    """包袱牌：深色包袱巾布紋＋打結的布耳＋粗深邊＋縫線＋朱紅印章＋引信。比一般牌重、沉一點。"""
    c = CARDS[cid]; acc = c['accent']; cloth = darken(acc, 0.55); edge = darken(acc, 0.32)
    clip = s.id('bc'); pad = 6; art_h = round((w - pad*2) * 0.62)
    o = [f'<g transform="rotate({rot} {x+w/2} {y+h})">']
    if shaking:
        o.append(f'<path d="M{x-7} {y+20}l-4 3M{x-7} {y+32}l-5 0M{x+w+7} {y+24}l4 -3M{x+w+7} {y+36}l5 0" stroke="{INK}" stroke-width="1.6" stroke-linecap="round"/>')
    # 布耳（結）— 突出牌頂
    kx = x + w/2
    o.append(f'<g filter="url(#rough)"><path d="M{kx-4} {y+6}c-10 -4 -18 -14 -12 -18c5 -3 10 4 12 12z" fill="{cloth}" stroke="{edge}" stroke-width="1.8"/>'
             f'<path d="M{kx+4} {y+6}c10 -4 18 -14 12 -18c-5 -3 -10 4 -12 12z" fill="{cloth}" stroke="{edge}" stroke-width="1.8"/></g>')
    o += [f'<g filter="url(#shadowHeavy)"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="9" fill="{cloth}"/></g>',
          f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="9" fill="url(#cloth)"/>',
          f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="9" fill="none" stroke="{edge}" stroke-width="4.5" filter="url(#rough)"/>',
          f'<rect x="{x+4.5}" y="{y+4.5}" width="{w-9}" height="{h-9}" rx="6" fill="none" stroke="{CHALK}" stroke-opacity=".55" stroke-width="1.2" stroke-dasharray="4 3"/>',
          f'<circle cx="{kx}" cy="{y+5}" r="6" fill="{cloth}" stroke="{edge}" stroke-width="2" filter="url(#rough)"/>',
          f'<clipPath id="{clip}"><rect x="{x+pad}" y="{y+pad+6}" width="{w-pad*2}" height="{art_h}" rx="3"/></clipPath>',
          f'<rect x="{x+pad}" y="{y+pad+6}" width="{w-pad*2}" height="{art_h}" rx="3" fill="{CHALK}"/>',
          f'<image href="{IMG(cid)}" x="{x+pad-(w-pad*2)*0.12}" y="{y+pad+6}" width="{(w-pad*2)*1.24}" height="{art_h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#{clip})" filter="url(#sepia)"/>']
    name = c['name']; ty = y + pad + 6 + art_h + 16
    lines = [name[:3], name[3:]] if len(name) > 4 else [name]
    for i, ln in enumerate(lines[:2]):
        o.append(f'<text x="{x+8}" y="{ty+i*14}" class="h" font-size="{12.5 if len(name)<=4 else 12}" font-weight="700" fill="{CHALK}">{esc(ln)}</text>')
    # 印章
    sx, sy = x + 20, y + pad + 17
    o.append(f'<g transform="rotate(-12 {sx} {sy})" filter="url(#rough)"><rect x="{sx-13}" y="{sy-9}" width="26" height="18" rx="3" fill="{PAPER}" fill-opacity=".9" stroke="#C8322E" stroke-width="2"/>'
             f'<text x="{sx}" y="{sy+4}" text-anchor="middle" class="t" font-size="10" fill="#C8322E">包袱</text></g>')
    # 引信
    o.append(fuse(x + 8, y + h - 10, w - 16, total, burned, 0.85))
    o.append('</g>'); s.add(''.join(o))

def fan(s, y, cards, w, h, margin=20, lift_idx=None, max_rot=5):
    """扇形手牌：牌數自動算間距；兩端各轉 max_rot 度、中間略高（弧形）。"""
    n = len(cards); avail = s.w - margin*2
    step = (avail - w) / max(n - 1, 1)
    step = min(step, w + 8)
    total_w = w + step*(n-1); x0 = (s.w - total_w) / 2
    for i, (kind, cid, *rest) in enumerate(cards):
        tpos = (i - (n-1)/2) / max((n-1)/2, 1)
        rot = tpos * max_rot
        dy = abs(tpos)**2 * 9
        x = x0 + i*step
        if kind == 'b':
            burden_card(s, x, y + dy + 6, w, h, cid, rot, *(rest or [3, 1]))
        else:
            action_card(s, x, y + dy - (14 if lift_idx == i else 0), w, h, cid, rot, lifted=lift_idx == i)
    return step

def sticky(s, y):
    """包袱每學期的懲罰：牌晃一下＋一張便條旁白（不寫數值）"""
    w = s.w - 60; x = 30
    s.add(f'<g transform="rotate(-1.2 {x+w/2} {y+24})"><g filter="url(#shadow)"><rect x="{x}" y="{y}" width="{w}" height="46" fill="#F7E7B8"/></g>'
          f'<rect x="{x+w/2-20}" y="{y-6}" width="40" height="12" fill="{TAPE}" opacity=".9"/>'
          f'<text x="{x+12}" y="{y+20}" class="h" font-size="13.5" fill="{INK}">「家裡的帳單」又晃了一下。</text>'
          f'<text x="{x+12}" y="{y+38}" class="h" font-size="11" fill="{MUTED}">（包袱每學期的旁白，文案待補）</text></g>')

def button(s, x, y, w, h, label, fill=BOARD, col=CHALK, size=16, outline=False):
    if outline:
        s.add(f'<g filter="url(#rough)"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="{PAPER}" stroke="{MUTED}" stroke-width="1.6"/></g>'
              f'<text x="{x+w/2}" y="{y+h/2+size*0.36}" text-anchor="middle" class="h" font-size="{size}" fill="{INK}">{esc(label)}</text>')
    else:
        s.add(f'<g filter="url(#shadow)"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="{fill}"/></g>'
              f'<rect x="{x+3}" y="{y+3}" width="{w-6}" height="{h-6}" rx="8" fill="none" stroke="{col}" stroke-opacity=".25" stroke-dasharray="5 4" filter="url(#rough)"/>'
              f'<text x="{x+w/2}" y="{y+h/2+size*0.36}" text-anchor="middle" class="h" font-size="{size}" fill="{col}">{esc(label)}</text>')

def time_row(s, y, total=3, used=1, done=('社團',), label='這學期的時間'):
    s.add(f'<text x="14" y="{y+19}" class="h" font-size="14" fill="{INK}">{label}</text>')
    for i in range(total):
        s.add(clock(116 + i*26, y + 14, 9, i >= used))
    if done:
        x = 200
        s.add(f'<text x="{x}" y="{y+19}" class="h" font-size="12" fill="{MUTED}">做了：</text>')
        for d in done:
            s.add(f'<g transform="rotate(-4 {x+60} {y+14})" filter="url(#rough)"><rect x="{x+36}" y="{y+3}" width="{len(d)*13+14}" height="22" rx="4" fill="none" stroke="{RED}" stroke-width="1.6"/>'
                  f'<text x="{x+43}" y="{y+19}" class="h" font-size="13" fill="{RED}">{esc(d)}</text></g>')

def note(s, x, y, text, size=11, col='#8A5BA8'):
    """設計標註（紫色手寫，不屬於遊戲畫面）"""
    s.add(f'<text x="{x}" y="{y}" class="h" font-size="{size}" fill="{col}" opacity=".9">{esc(text)}</text>')

def hand_label(s, y, n_burden):
    s.add(f'<text x="14" y="{y}" class="h" font-size="12" fill="{MUTED}">手牌</text>')
    if n_burden:
        s.add(f'<text x="{s.w-14}" y="{y}" text-anchor="end" class="h" font-size="12" fill="{darken("#7A6A55",0.8)}">背著的包袱佔掉位置</text>')

# ---------- 畫面 ----------
SIZES = {'390x844': (390, 844, 47, 34), '375x667': (375, 667, 20, 0)}

def scene_result(s, top, bottom, cid='s_club', played='社團'):
    """中央舞台：上一張打出的牌的結果（拍立得＋手寫旁白）"""
    avail = bottom - top
    c = CARDS[cid]
    if avail > 360:
        pw = 300; ih = 180
    else:
        pw = 230; ih = 128
    H = polaroid(s, (s.w - pw)/2, top + 14, pw, cid, -1.6, f'你打出了「{played}」', ih)
    ty = top + 14 + H + 28
    textblock(s, 24, ty, c['result_text'], 15 if avail > 360 else 14, 22 if avail > 360 else 23)

def option_A(size, variant='turn'):
    w, h, st, sb = SIZES[size]; big = h > 700
    s = S(w, h, st, sb, f'方案 A：扇形手牌＋底部詳情 {size}')
    bh = 52; by = h - sb - 8 - bh
    cw, ch = (88, 128) if big else (74, 108)
    hand_top = by - 10 - ch - 14
    time_y = hand_top - 18 - 30
    topbar(s, st + 2, 44)
    stats(s, st + 50, 42 if big else 38)
    scene_top = st + 50 + (42 if big else 38) + 2
    if variant in ('turn', 'sheet'):
        scene_result(s, scene_top, time_y - 4)
        time_row(s, time_y, 3, 1)
        hand_label(s, hand_top - 6, 2)
        sticky(s, time_y - 62)
        cards = [('b', 'b_bill', 4, 3, True), ('b', 'b_tired', 3, 1), ('a', 's_study'), ('a', 's_love'), ('a', 's_work')] if big else \
                [('b', 'b_bill', 4, 3, True), ('b', 'b_tired', 3, 1), ('a', 's_study'), ('a', 's_love'), ('a', 's_work'), ('a', 's_game'), ('a', 's_skip')]
        step = fan(s, hand_top + 8, cards, cw, ch, margin=20 if big else 16)
        print(size, 'fan step', round(step, 1), 'cards', len(cards))
        button(s, 12, by, w - 24, bh, '剩下的時間拿來休息，過完這學期')
    if variant == 'sheet':
        sheet_action(s, 's_love')
    if variant == 'sheet_burden':
        scene_result(s, scene_top, time_y - 4)
        time_row(s, time_y, 3, 1)
        cards = [('b', 'b_bill', 4, 3), ('b', 'b_tired', 3, 1), ('a', 's_study'), ('a', 's_love'), ('a', 's_work')]
        fan(s, hand_top + 8, cards, cw, ch, margin=20 if big else 16)
        button(s, 12, by, w - 24, bh, '剩下的時間拿來休息，過完這學期')
        sheet_burden(s, 'b_bill', 4, 3)
    return s

def sheet_action(s, cid):
    c = CARDS[cid]; acc = c['accent']; big = s.h > 700
    s.add(f'<rect width="{s.w}" height="{s.h}" fill="#33302B" opacity=".5"/>')
    maxh = round(s.h * (0.74 if big else 0.86))
    top = s.h - maxh
    s.add(f'<g filter="url(#shadowHeavy)"><path d="M0 {top+18}q0 -18 18 -18h{s.w-36}q18 0 18 18V{s.h}H0z" fill="{PAPER}"/></g>')
    s.add(f'<path d="M0 {top+18}q0 -18 18 -18h{s.w-36}q18 0 18 18V{s.h}H0z" fill="url(#lines)" opacity=".7"/>')
    s.add(f'<path d="M0 {top+18}q0 -18 18 -18h{s.w-36}q18 0 18 18" fill="none" stroke="{acc}" stroke-width="5" filter="url(#rough)"/>')
    s.add(f'<rect x="{s.w/2-20}" y="{top+9}" width="40" height="5" rx="2.5" fill="{MUTED}" opacity=".5"/>')
    # 關閉
    s.add(f'<g filter="url(#rough)"><circle cx="{s.w-34}" cy="{top+34}" r="18" fill="{PAPER}" stroke="{MUTED}" stroke-width="1.4"/><path d="M{s.w-40} {top+28}l12 12M{s.w-28} {top+28}l-12 12" stroke="{INK}" stroke-width="2" stroke-linecap="round"/></g>')
    aw = s.w - 48; ah = round(aw * 9 / 16) if big else round(aw * 0.5)
    H = polaroid(s, 24, top + 56, aw, cid, -1.2, None, ah)
    y = top + 56 + H + 36
    s.add(f'<text x="26" y="{y}" class="t" font-size="24" fill="{INK}">{esc(c["name"])}</text>')
    s.add(f'<path d="M24 {y+8}q40 5 {len(c["name"])*24+6} -2" stroke="{acc}" stroke-width="5" opacity=".6" fill="none" stroke-linecap="round" filter="url(#rough)"/>')
    s.add(f'<g filter="url(#rough)"><rect x="{s.w-132}" y="{y-20}" width="106" height="26" rx="13" fill="{mix(acc,PAPER,.82)}" stroke="{acc}" stroke-width="1.4"/></g>'
          f'<path d="M{s.w-122} {y-14}h8l-8 10h8z" fill="none" stroke="{acc}" stroke-width="1.6"/>'
          f'<text x="{s.w-108}" y="{y-2}" class="h" font-size="12.5" fill="{darken(acc,.7)}">高中畢業前</text>')
    y += 34
    y += textblock(s, 26, y, c['line'], 17, 19)
    y += 6
    s.add(f'<text x="26" y="{y+4}" class="h" font-size="13" fill="{MUTED}">要花的時間</text>')
    s.add(clock(118, y, 9, True, acc))
    note(s, 150, y + 4, '← 時鐘個數＝成本，不寫數字')
    bh = 54; by = s.h - (34 if big else 0) - 12 - bh
    button(s, 24, by - 52 - 10, s.w - 48, 52, '再想想', outline=True)
    button(s, 24, by, s.w - 48, bh, f'就做這個', fill=acc, col='#FFFFFF', size=18)
    s.add(f'<text x="{s.w/2}" y="{by - 52 - 22}" text-anchor="middle" class="h" font-size="12" fill="{MUTED}">選了就算數，不能反悔。</text>')

def sheet_burden(s, cid, total, burned):
    c = CARDS[cid]; acc = c['accent']; cloth = darken(acc, .55); edge = darken(acc, .32); big = s.h > 700
    s.add(f'<rect width="{s.w}" height="{s.h}" fill="#33302B" opacity=".5"/>')
    maxh = round(s.h * (0.74 if big else 0.86)); top = s.h - maxh
    s.add(f'<g filter="url(#shadowHeavy)"><path d="M0 {top+18}q0 -18 18 -18h{s.w-36}q18 0 18 18V{s.h}H0z" fill="{cloth}"/></g>')
    s.add(f'<path d="M0 {top+18}q0 -18 18 -18h{s.w-36}q18 0 18 18V{s.h}H0z" fill="url(#cloth)"/>')
    s.add(f'<path d="M0 {top+18}q0 -18 18 -18h{s.w-36}q18 0 18 18" fill="none" stroke="{edge}" stroke-width="7" filter="url(#roughBig)"/>')
    s.add(f'<rect x="10" y="{top+14}" width="{s.w-20}" height="{maxh}" rx="12" fill="none" stroke="{CHALK}" stroke-opacity=".45" stroke-dasharray="6 4"/>')
    kx = s.w/2
    s.add(f'<g filter="url(#rough)"><path d="M{kx-6} {top+4}c-16 -6 -30 -22 -20 -28c8 -5 16 6 20 20z" fill="{cloth}" stroke="{edge}" stroke-width="2.4"/><path d="M{kx+6} {top+4}c16 -6 30 -22 20 -28c-8 -5 -16 6 -20 20z" fill="{cloth}" stroke="{edge}" stroke-width="2.4"/><circle cx="{kx}" cy="{top+4}" r="9" fill="{cloth}" stroke="{edge}" stroke-width="2.4"/></g>')
    aw = s.w - 60; ah = round(aw * 0.5)
    clip = s.id('sb')
    s.add(f'<clipPath id="{clip}"><rect x="30" y="{top+40}" width="{aw}" height="{ah}" rx="4"/></clipPath><rect x="30" y="{top+40}" width="{aw}" height="{ah}" rx="4" fill="{CHALK}"/>'
          f'<image href="{IMG(cid)}" x="30" y="{top+40}" width="{aw}" height="{ah}" preserveAspectRatio="xMidYMid slice" clip-path="url(#{clip})" filter="url(#sepia)"/>')
    sx, sy = s.w - 70, top + 40 + ah - 10
    s.add(f'<g transform="rotate(-10 {sx} {sy})" filter="url(#rough)"><rect x="{sx-30}" y="{sy-18}" width="60" height="36" rx="4" fill="{PAPER}" fill-opacity=".85" stroke="#C8322E" stroke-width="3"/><text x="{sx}" y="{sy+8}" text-anchor="middle" class="t" font-size="20" fill="#C8322E">包袱</text></g>')
    y = top + 40 + ah + 40
    s.add(f'<text x="30" y="{y}" class="t" font-size="24" fill="{CHALK}">{esc(c["name"])}</text>')
    y += 30
    y += textblock(s, 30, y, c['line'], 15.5, 20, col=CHALK)
    y += 4
    s.add(f'<text x="30" y="{y+5}" class="h" font-size="13" fill="{CHALK}" opacity=".85">背了好一陣子了</text>')
    s.add(fuse(140, y, s.w - 180, total, burned, 1.4))
    y += 26
    s.add(f'<text x="30" y="{y+4}" class="h" font-size="13" fill="#F2B85A">引信燒完，就會出事。</text>')
    bh = 54; by = s.h - (34 if big else 0) - 12 - bh
    button(s, 24, by - 50 - 10, s.w - 48, 50, '先背著（每學期都會痛）', fill=PAPER, col=INK, size=15)
    button(s, 24, by, s.w - 48, bh, '', fill=TAPE, col=INK)
    s.add(f'<text x="{s.w/2+14}" y="{by+bh/2+6}" text-anchor="middle" class="h" font-size="16" fill="{INK}">花時間處理掉（暫時的）</text>')
    s.add(clock(s.w/2 - 98, by + bh/2, 9, True, INK))

# ---------- 方案 B：抽屜手牌 ----------
def option_B(size, open_=False):
    w, h, st, sb = SIZES[size]; big = h > 700
    s = S(w, h, st, sb, f'方案 B：抽屜手牌 {size}{"（展開）" if open_ else ""}')
    topbar(s, st + 2, 44)
    sh = 42 if big else 38
    stats(s, st + 50, sh)
    scene_top = st + 50 + sh + 2
    bh = 52; by = h - sb - 8 - bh
    peek_h = 92 if big else 84
    drawer_top = by - 8 - peek_h - 26
    if not open_:
        # 舞台比 A 大：拍立得放大
        avail = drawer_top - scene_top
        pw = w - 60 if big else 250; ih = round(pw * (0.62 if big else 0.55))
        H = polaroid(s, (w - pw)/2, scene_top + 16, pw, 's_club', -1.4, '你打出了「社團」', ih)
        ty = scene_top + 16 + H + 26
        textblock(s, 24, ty, CARDS['s_club']['result_text'], 15, 22)
        time_row(s, drawer_top - 40, 3, 1)
        drawer(s, drawer_top, by, peek_h, big)
        button(s, 12, by, w - 24, bh, '剩下的時間拿來休息，過完這學期')
    else:
        # 背景舞台暗掉
        pw = w - 60 if big else 250; ih = round(pw * (0.62 if big else 0.55))
        polaroid(s, (w - pw)/2, scene_top + 16, pw, 's_club', -1.4, '你打出了「社團」', ih)
        s.add(f'<rect width="{w}" height="{h}" fill="#33302B" opacity=".45"/>')
        drawer_open(s, st + 96 if big else st + 50, by, big)
    return s

def drawer_panel(s, top, bottom):
    s.add(f'<g filter="url(#shadowHeavy)"><path d="M0 {top+20}q0 -20 20 -20h{s.w-40}q20 0 20 20V{s.h}H0z" fill="#E4D9C3"/></g>')
    s.add(f'<path d="M0 {top+20}q0 -20 20 -20h{s.w-40}q20 0 20 20V{s.h}H0z" fill="url(#hatch)" opacity=".35"/>')
    s.add(f'<path d="M8 {top+18}q0 -12 14 -12h{s.w-44}q14 0 14 12" fill="none" stroke="#8A6A4A" stroke-width="1.4" stroke-dasharray="5 4"/>')
    # 書包扣帶＝把手（44px 高）
    s.add(f'<g filter="url(#rough)"><rect x="{s.w/2-34}" y="{top-14}" width="68" height="30" rx="8" fill="#8A6A4A"/><rect x="{s.w/2-12}" y="{top-6}" width="24" height="14" rx="3" fill="none" stroke="{TAPE}" stroke-width="2"/></g>')

def drawer(s, top, by, peek_h, big):
    drawer_panel(s, top, by)
    s.add(f'<text x="14" y="{top+20}" class="h" font-size="12" fill="#6A5238">手牌（往上拉看大張）</text>')
    cards = [('b', 'b_bill', 4, 3), ('b', 'b_tired', 3, 1), ('a', 's_study'), ('a', 's_love'), ('a', 's_work')]
    if not big: cards += [('a', 's_game'), ('a', 's_skip')]
    n = len(cards); cw = 64 if big else 46; gap = (s.w - 24 - n*cw) / (n - 1)
    y = top + 28
    for i, (k, cid, *r) in enumerate(cards):
        x = 12 + i*(cw + gap); rot = [-3, 2, -1.5, 2.5, -2, 1.5, -2.5][i]
        peek(s, x, y, cw, peek_h - 6, cid, k == 'b', rot, *(r or [3, 1]))

def peek(s, x, y, w, h, cid, burden, rot, total=3, burned=1):
    """抽屜收起時的牌頭：只露出圖＋名字，下半截被書包口蓋住"""
    c = CARDS[cid]; acc = c['accent']; clip = s.id('pk')
    fill = darken(acc, .55) if burden else PAPER
    edge = darken(acc, .32) if burden else acc
    o = [f'<g transform="rotate({rot} {x+w/2} {y+h})">',
         f'<g filter="url({"#shadowHeavy" if burden else "#shadow"})"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="7" fill="{fill}"/></g>']
    if burden: o.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="7" fill="url(#cloth)"/>')
    o.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="7" fill="none" stroke="{edge}" stroke-width="{4 if burden else 2.4}" filter="url(#rough)"/>')
    ah = round(w * 0.62)
    o.append(f'<clipPath id="{clip}"><rect x="{x+4}" y="{y+4}" width="{w-8}" height="{ah}" rx="3"/></clipPath>'
             f'<image href="{IMG(cid)}" x="{x+4-w*0.12}" y="{y+4}" width="{(w-8)*1.3}" height="{ah}" preserveAspectRatio="xMidYMid slice" clip-path="url(#{clip})" {"filter=\"url(#sepia)\"" if burden else ""}/>')
    nm = c['name']; fs = 11.5 if w < 56 else 12.5
    lines = wrap(nm, 3 if w < 56 else 4) if len(nm) > (3 if w < 56 else 4) else [nm]
    for i, ln in enumerate(lines[:2]):
        o.append(f'<text x="{x+5}" y="{y+ah+18+i*13}" class="h" font-size="{fs}" font-weight="700" fill="{CHALK if burden else INK}">{esc(ln)}</text>')
    if burden:
        o.append(f'<circle cx="{x+w/2}" cy="{y+2}" r="5" fill="{fill}" stroke="{edge}" stroke-width="1.8"/>')
        o.append(fuse(x + 5, y + h - 7, w - 10, total, burned, 0.6))
    o.append('</g>'); s.add(''.join(o))

def drawer_open(s, top, by, big):
    drawer_panel(s, top, by)
    y = top + 30
    s.add(f'<text x="16" y="{y}" class="h" font-size="13" fill="#6A5238">背著的包袱</text>')
    bw = (s.w - 40) / 2; bh = 76 if big else 66
    for i, (cid, tot, bur) in enumerate([('b_bill', 4, 3), ('b_tired', 3, 1)]):
        burden_wide(s, 14 + i*(bw + 12), y + 10, bw, bh, cid, tot, bur)
    y += bh + 40
    s.add(f'<text x="16" y="{y}" class="h" font-size="13" fill="#6A5238">手牌</text>')
    ids = ['s_study', 's_love', 's_work'] + ([] if big else ['s_game', 's_skip'])
    cols = 3 if big else 5
    cw = (s.w - 28 - (cols-1)*10) / cols; ch = round(cw * 1.38) if big else round(cw*1.45)
    for i, cid in enumerate(ids):
        r, cidx = divmod(i, cols)
        action_card(s, 14 + cidx*(cw + 10), y + 12 + r*(ch + 12), cw, ch, cid, [-2, 1.5, -1, 2, -1.5][i], lifted=(cid == 's_love'), small_title=15 if big else 12)
    y2 = y + 12 + ch + 22
    # 選中的牌：抽屜內直接顯示全文＋確認（不另開詳情）
    c = CARDS['s_love']
    s.add(f'<g filter="url(#rough)"><rect x="14" y="{y2}" width="{s.w-28}" height="{by-y2-12}" rx="10" fill="{PAPER}" stroke="{c["accent"]}" stroke-width="2.4"/></g>')
    ph = by - y2 - 12; pw = s.w - 28
    ah = min(round((pw - 20) * 9 / 16), ph - 112); clip = s.id('bo')
    s.add(f'<clipPath id="{clip}"><rect x="24" y="{y2+10}" width="{pw-20}" height="{ah}" rx="4"/></clipPath><image href="{IMG("s_love")}" x="24" y="{y2+10}" width="{pw-20}" height="{ah}" preserveAspectRatio="xMidYMid slice" clip-path="url(#{clip})"/>')
    ty = y2 + 10 + ah + 30
    s.add(f'<text x="28" y="{ty}" class="t" font-size="19" fill="{INK}">{c["name"]}</text>')
    s.add(f'<path d="M{s.w-122} {ty-14}h8l-8 10h8z" fill="none" stroke="{c["accent"]}" stroke-width="1.6"/><text x="{s.w-108}" y="{ty-3}" class="h" font-size="12.5" fill="{darken(c["accent"],.7)}">高中畢業前</text>')
    s.add(clock(s.w - 132 - 20, ty - 9, 8, True, c['accent']))
    textblock(s, 28, ty + 28, c['line'], 14.5, 22 if big else 21)
    button(s, 12, by, s.w - 24, 52, '就做「戀愛」', fill=c['accent'], col='#FFFFFF', size=17)

def burden_wide(s, x, y, w, h, cid, total, burned):
    c = CARDS[cid]; acc = c['accent']; cloth = darken(acc, .55); edge = darken(acc, .32); clip = s.id('bw')
    s.add(f'<g filter="url(#shadowHeavy)"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="9" fill="{cloth}"/></g><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="9" fill="url(#cloth)"/>'
          f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="9" fill="none" stroke="{edge}" stroke-width="4.5" filter="url(#rough)"/>'
          f'<path d="M{x+w-14} {y+2}c6 -8 14 -10 12 -2c-2 5 -8 6 -12 6zM{x+w-14} {y+2}c-2 -9 -10 -13 -12 -6c-1 4 6 6 12 6z" fill="{cloth}" stroke="{edge}" stroke-width="1.6"/>'
          f'<clipPath id="{clip}"><rect x="{x+7}" y="{y+7}" width="{h-14}" height="{h-14}" rx="4"/></clipPath>'
          f'<image href="{IMG(cid)}" x="{x+7-(h-14)*0.4}" y="{y+7}" width="{(h-14)*1.8}" height="{h-14}" preserveAspectRatio="xMidYMid slice" clip-path="url(#{clip})" filter="url(#sepia)"/>'
          f'<text x="{x+h}" y="{y+26}" class="h" font-size="14" font-weight="700" fill="{CHALK}">{esc(c["name"])}</text>')
    s.add(fuse(x + h, y + h - 16, w - h - 10, total, burned, 0.8))

# ---------- 童年序章：三選一 ----------
# 文字取自 writing/v1.2_childhood_memory_cards.md（第一幕：六歲）。記憶牌還沒有插圖 → 用主色的佔位圖框。
# 類別主色（提案）：沿用該類「建議洗入」代表牌的 accent。
CLASS_ACC = {'study': '#3A6FB0', 'play': '#4A7038', 'exercise': '#A8322D', 'talent': '#6B4A8C', 'work': '#B8902F'}
# 第一幕（六歲）三張，三個不同類別；文字逐字取自 writing/v1.2_childhood_memory_cards.md（定稿版，含「先寫功課」）
MEMS = [
 ('study', '先寫功課', '卡通的片頭曲都響了，你的數學習作還剩最後一題。', '你學會先把該做的做完；代價是每部卡通都從中間開始看。', 'd_study'),
 ('exercise', '拆掉輔助輪', '拆掉輔助輪那天你摔了好幾次，紅藥水沒乾又牽車出門。', '你不太怕跌倒，身體也比較跟得上你想做的事。', 'd_exercise'),
 ('work', '店裡的小板凳', '放學就坐在店裡的小板凳，客人進門你比大人先喊歡迎。', '你比同年紀早學會看場合、算零錢；自己玩的時間少一點。', 'd_shop'),
]
SEL = 1
# 類別小圖示（24×24 線稿，沒有數字）
CAT_ICON = {
 'study': SB_ICONS['academic'],
 'play': '<path d="M12 3l7 7-7 11-7-11z"/><path d="M12 21v-0M5 10h14"/><path d="M12 21c1 1.5 2.5 2 4 1.5"/>',  # 風箏
 'exercise': '<circle cx="6" cy="16" r="4"/><circle cx="18" cy="16" r="4"/><path d="M6 16l4-7h5l3 7M10 9l2 7h6M9 6h3"/>',  # 腳踏車
 'talent': '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',  # 音符
 'work': '<path d="M3 10l2-5h14l2 5"/><path d="M3 10c0 1.7 1.3 2.5 3 2.5S9 11.7 9 10c0 1.7 1.3 2.5 3 2.5s3-.8 3-2.5c0 1.7 1.3 2.5 3 2.5s3-.8 3-2.5"/><path d="M5 12.5V20h14v-7.5M10 20v-4h4v4"/>',  # 店面遮雨棚
}
CAT_NAME = {'study': '讀書', 'play': '玩樂', 'exercise': '運動', 'talent': '才藝', 'work': '顧家'}

def art_placeholder(x, y, w, h, acc, small=False):
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="4" fill="{mix(acc, PAPER, .78)}"/>'
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="4" fill="url(#hatch)" opacity=".7"/>'
            f'<rect x="{x+3}" y="{y+3}" width="{w-6}" height="{h-6}" rx="3" fill="none" stroke="{acc}" stroke-width="1.6" stroke-dasharray="5 4" filter="url(#rough)"/>'
            f'<g opacity=".55" filter="url(#rough)"><circle cx="{x+w/2}" cy="{y+h*0.36}" r="{h*0.14}" fill="{PAPER}" stroke="{acc}" stroke-width="1.6"/>'
            f'<path d="M{x+w/2-h*0.22} {y+h*0.76}q{h*0.22} -{h*0.32} {h*0.44} 0" fill="{PAPER}" stroke="{acc}" stroke-width="1.6"/></g>'
            f'<text x="{x+w/2}" y="{y+h-7}" text-anchor="middle" class="h" font-size="{9 if small else 10}" fill="{darken(acc,.7)}">插圖待補</text>')

def mem_card(s, x, y, w, h, m, rot, sel, big):
    cls, name, situ, cons, adds = m; acc = CLASS_ACC[cls]
    aw = 84 if big else 72; pad = 9
    o = [f'<g transform="rotate({rot} {x+w/2} {y+h/2})">']
    if sel: o.append(f'<rect x="{x-5}" y="{y-5}" width="{w+10}" height="{h+10}" rx="12" fill="{acc}" opacity=".26"/>')
    o += [f'<g filter="url(#shadow)"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="{PAPER}"/></g>',
          f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="none" stroke="{acc}" stroke-width="{3.4 if sel else 2.4}" filter="url(#rough)"/>',
          art_placeholder(x+pad, y+pad, aw, h-pad*2-22, acc, not big),
          f'<rect x="{x+pad+aw/2-16}" y="{y+2}" width="32" height="11" fill="{TAPE}" opacity=".85" transform="rotate(-6 {x+pad+aw/2} {y+6})"/>']
    # 會放進牌堆：圖窗下方的小籤
    o.append(f'<text x="{x+pad+aw/2}" y="{y+h-pad-4}" text-anchor="middle" class="h" font-size="{10.5 if big else 10}" fill="{darken(acc,.75)}">＋{esc(CARDS[adds]["name"])}</text>')
    tx = x + pad + aw + 10; tw = w - (tx - x) - 10
    # 類別圖示（圓章）＋牌名
    o.append(f'<g filter="url(#rough)"><circle cx="{tx+11}" cy="{y+pad+11}" r="11" fill="{mix(acc,PAPER,.8)}" stroke="{acc}" stroke-width="1.4"/></g>'
             f'<g transform="translate({tx+4},{y+pad+4}) scale(.58)" fill="none" stroke="{darken(acc,.8)}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">{CAT_ICON[cls]}</g>')
    o.append(f'<text x="{tx+28}" y="{y+pad+17}" class="t" font-size="{16 if big else 15}" fill="{INK}">{esc(name)}</text>')
    fs = 13 if big else 12.5; per = int(tw // fs)
    sl = wrap(situ, per); yy = y + pad + 22 + fs*1.5
    for j, ln in enumerate(sl[:2]):
        o.append(f'<text x="{tx}" y="{yy + j*fs*1.45:.1f}" class="s" font-size="{fs}" fill="{INK}">{esc(ln)}</text>')
    yy += (len(sl[:2]) - 1)*fs*1.45 + 9
    o.append(f'<path d="M{tx} {yy}h{tw}" stroke="{acc}" stroke-width="1.3" stroke-dasharray="4 3" opacity=".6"/>')
    cf = 12 if big else 11.5; per2 = int((tw - 14) // cf)
    cl = wrap(cons, per2); yy += cf*1.45 + 2
    o.append(f'<path d="M{tx+1} {yy-cf*0.8}v{cf*0.5}q0 3 3 3h5l-2 -2m2 2l-2 2" stroke="{acc}" stroke-width="1.4" fill="none" stroke-linecap="round"/>')
    for j, ln in enumerate(cl[:2]):
        o.append(f'<text x="{tx+14}" y="{yy + j*cf*1.45:.1f}" class="h" font-size="{cf}" fill="{mix(MUTED, acc, .25)}">{esc(ln)}</text>')
    if sel:
        o.append(f'<g filter="url(#rough)"><circle cx="{x+w-14}" cy="{y+14}" r="11" fill="{acc}"/><path d="M{x+w-19} {y+14}l4 4l7 -8" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/></g>')
    o.append('</g>'); s.add(''.join(o))
    return len(sl), len(cl)

def prologue(size):
    w, h, st, sb = SIZES[size]; big = h > 700
    s = S(w, h, st, sb, f'童年序章：三選一 {size}')
    y = st + 12; hh = 60 if big else 50
    s.add(f'<g filter="url(#shadow)"><rect x="10" y="{y}" width="{w-20}" height="{hh}" rx="10" fill="{BOARD}"/></g>')
    s.add(f'<text x="26" y="{y+hh/2+7}" class="t" font-size="{20 if big else 18}" fill="{CHALK}">童年・剛上小學</text>')
    for i in range(3):
        s.add(f'<circle cx="{w-80+i*22}" cy="{y+hh/2}" r="7" fill="{TAPE if i == 0 else "none"}" stroke="{CHALK}" stroke-width="1.6" filter="url(#rough)"/>')
    y += hh + (30 if big else 24)
    s.add(f'<text x="{w/2}" y="{y}" text-anchor="middle" class="h" font-size="{17 if big else 16}" fill="{INK}">那時候，你最常在做什麼？</text>')
    s.add(f'<text x="{w/2}" y="{y+22}" text-anchor="middle" class="h" font-size="12.5" fill="{MUTED}">挑你最記得的那件事，它會變成以後抽得到的牌。</text>')
    y += 22 + (26 if big else 16)
    ch = 150 if big else 124; gap = 16 if big else 10
    for i, m in enumerate(MEMS):
        sel = i == SEL
        x = 12 + (0 if not sel else -2); cw = w - 24
        r = mem_card(s, x, y + i*(ch + gap) - (4 if sel else 0), cw, ch, m, [-1.2, 0.8, -0.6][i], sel, big)
        print(size, m[1], 'situ lines', r[0], 'cons lines', r[1])
    y += 3*ch + 2*gap
    bh = 54; by = h - sb - 10 - bh
    acc = CLASS_ACC[MEMS[SEL][0]]
    button(s, 12, by, w - 24, bh, '就是這個', fill=acc, col='#FFFFFF', size=18)
    if big:
        note(s, 14, by - 26, '幕次＝右上三個圓點；類別＝牌名前的小圓章（不寫數字）', 10.5)
        note(s, 14, by - 10, '點牌＝選取（抬高＋光暈），按鈕才定案；記憶牌圖待補，先用主色佔位框', 10.5)
    print(size, 'cards end', y, 'button top', by)
    return s

# ---------- 牌面解剖 ----------
def anatomy():
    s = S(1000, 560, 0, 0, '手牌牌面解剖（2 倍放大）')
    s.add(f'<text x="24" y="40" class="t" font-size="22" fill="{INK}">手牌牌面解剖（畫面 2 倍放大）</text>')
    inner = S(0, 0, 0, 0, ''); inner.uid = 100
    action_card(inner, 0, 10, 88, 128, 's_love', 0)
    s.add('<g transform="translate(30,80) scale(2)">' + ''.join(inner.parts) + '</g>')
    inner2 = S(0, 0, 0, 0, ''); inner2.uid = 200
    burden_card(inner2, 0, 16, 88, 128, 'b_bill', 0, 4, 3)
    s.add('<g transform="translate(530,70) scale(2)">' + ''.join(inner2.parts) + '</g>')
    P = '#8A5BA8'
    labels = [(30, 72, '一般手牌 88×128（375 寬：74×108）', INK),
              (225, 110, '① 圖窗：寬−10，高＝(寬−10)×0.72', P), (225, 132, '   16:9 原圖置中裁切（cover，左右放大 12%）', P),
              (225, 200, '② 名字：粉圓 13px 粗，最多兩行', P), (225, 222, '③ 主色蠟筆底線＝這張牌的 accent', P),
              (225, 262, '④ 外框 2.6px＝accent，手繪抖動', P), (225, 316, '⑤ 右下：時鐘＝時間成本（個數）', P),
              (225, 338, '⑥ 左下沙漏＝會過期（不寫幾歲）', P),
              (530, 56, '包袱牌：同尺寸，視覺重量加倍', INK),
              (725, 100, 'a 布耳打結：凸出牌頂約 14px', P), (725, 122, 'b 布紋底＝accent×0.55', P), (725, 144, '   深邊＝accent×0.32，粗 4.5px', P),
              (725, 166, 'c 內縫線：粉筆白虛線', P), (725, 206, 'd 印章「包袱」放左上（扇形裡', P), (725, 228, '   左半邊永遠看得到），斜 12°', P),
              (725, 262, 'e 圖窗褪成舊照片色（sepia）', P), (725, 312, 'f 名字粉筆白，三字斷行', P),
              (725, 352, 'g 引信：段數＝放多久會爆', P), (725, 374, '   燒黑＝已背的學期，火星＝現在', P), (725, 396, '   燒完 → 觸發事件牌', P),
              (725, 430, 'h 陰影更重，在手牌裡下沉 6px', P), (725, 452, 'i 每學期痛一次：牌晃一下＋便條旁白', P)]
    for x, y, t, c in labels: note(s, x, y, t, 13, c)
    note(s, 24, 506, '不寫任何數字：成本＝時鐘個數、過期＝沙漏、背多久＝引信燒到哪。點開才看全文。', 14, MUTED)
    note(s, 24, 532, '主色：每張牌自己的 accent（data/deck/cards.json），只用在外框、底線、選取光暈、詳情按鈕，不整張塗滿。', 14, MUTED)
    return s

if __name__ == '__main__':
    files = {}
    for sz in SIZES:
        files[f'option-A-{sz}'] = option_A(sz)
        files[f'option-A-detail-{sz}'] = option_A(sz, 'sheet')
        files[f'option-A-burden-detail-{sz}'] = option_A(sz, 'sheet_burden')
        files[f'prologue-{sz}'] = prologue(sz)
    files['card-anatomy'] = anatomy()
    for k, s in files.items():
        open(os.path.join(OUT, k + '.svg'), 'w').write(s.svg())
    print('\n'.join(sorted(files)))
