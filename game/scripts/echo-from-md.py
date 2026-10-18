#!/usr/bin/env python3
"""v1.2 新回音牌：writing/v1.2_echo_classmates_text.md 的「(a) 新回音牌」→ data/deck/cards_v12.json＋v12.json。

用法（repo 根目錄）：python3 game/scripts/echo-from-md.py [--social-mid N]
- 文字（name／line／album_text）、觸發條件、年齡、苦暖區分、上限都從 md 讀；〔E-12〕這類來源標記刪掉。
- 同 id 的牌就地更新、新牌接在最後一張回音牌後面；v12.json 補 start_adds、play_flags.crammed、echo_caps。
- --social-mid N：人際門檻覆蓋（暖版 stats_min social=N、苦版 stats_max social=N-1），沒給就用 md 裡寫的。
- (b) 同學近況是 v1.3，不轉。
欄位（引擎 deck.ts v12Eligible）：stats_min／stats_max（屬性門檻，回音進手牌那一刻的值）、flags_any_also（第二組「任一」旗標，和 flags_any 同時成立）、
echo_cap_group＋v12.json echo_caps（同組每局最多幾張）＋echo_cap_from（最早 [年齡, 學期]）、draw_weight（抽中權重倍率）。
"""
import json, re, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MD = ROOT / 'writing/v1.2_echo_classmates_text.md'
CARDS = ROOT / 'data/deck/cards_v12.json'
V12 = ROOT / 'data/deck/v12.json'
CAP_GROUP = 'adult_echo'

social_mid = None
if '--social-mid' in sys.argv: social_mid = int(sys.argv[sys.argv.index('--social-mid') + 1])

rev = subprocess.run(['git', 'log', '-1', '--format=%h', '--', str(MD)], cwd=ROOT, capture_output=True, text=True).stdout.strip() or 'uncommitted'
md = MD.read_text(encoding='utf-8')
sec = md.split('## (a) 新回音牌', 1)[1].split('\n## (b)', 1)[0]
cap_rule = re.search(r'每局最多出兩張\*\*，每張抽中權重 \*\*([0-9.]+)\*\*', sec)
weight = float(cap_rule.group(1)) if cap_rule else 0.5
cap_n = 2 if '每局最多出兩張' in sec else None
src_tag = re.compile(r'〔[^〕]*〕')
def clean(s): return src_tag.sub('', s).strip()
def conds(text):
    """`flags_any: ["a","b"]`、`stats_min: {"social": 50}` 這類寫法 → dict"""
    out = {}
    for k, v in re.findall(r'`(\w+): (\[[^`]*\]|\{[^`]*\})`', text): out[k] = json.loads(v)
    return out

cards, caps = [], set()
for blk in re.split(r'\n### ', sec)[1:]:
    head, body = blk.split('\n', 1)
    m = re.search(r'（(e_\w+)／(e_\w+)）', head); bitter_id, warm_id = m.group(1), m.group(2)
    bullets = {re.sub(r'（[^）]*）$', '', b.split('：', 1)[0].strip()): b.split('：', 1)[1] for b in re.findall(r'^- (.+)$', body, re.M) if '：' in b}
    trig = conds(bullets['觸發']); a0, a1 = map(int, re.search(r'年齡 (\d+)–(\d+)', bullets['觸發']).groups())
    split = bullets['苦暖區分']
    warm_c = conds(split.split('暖版', 1)[1].split('苦版', 1)[0]); bitter_c = conds(split.split('苦版', 1)[1])
    capped = bullets.get('上限', '').strip().startswith('算在 19–22 歲六組裡')  # 「不算在…」的不算
    eff = {'bitter': {'happiness': -1}, 'warm': {'happiness': 2}}
    if '苦版 `{"happiness": -1}`、暖版 `{"happiness": 2}`' not in bullets.get('效果', ''): raise SystemExit(f'{head}: 效果和企劃定案不同，先確認')
    rows = {r[0]: [clean(x) for x in r[1:]] for r in (list(map(str.strip, l.strip('|').split('|'))) for l in body.splitlines() if l.startswith('| 苦') or l.startswith('| 暖'))}
    for ver, cid, vc in (('苦', bitter_id, bitter_c), ('暖', warm_id, warm_c)):
        name, line, album = rows[ver]
        c = {'id': cid, 'echo_card': True, 'name': name, 'type': 'forced', 'cost': None, 'age_min': a0, 'age_max': a1, 'expires_age': None, 'line': line,
             'effects': eff['bitter' if ver == '苦' else 'warm'], 'removes': [cid, warm_id if ver == '苦' else bitter_id], 'cooldown': 2, 'cooldown_group': CAP_GROUP if capped else 'echo',
             '_src': f'新回音牌（企劃 10/17 定案）；文字與條件：writing/v1.2_echo_classmates_text.md（{rev}），由 game/scripts/echo-from-md.py 轉出', 'album_text': album}
        c.update(trig)
        for k, v in vc.items():
            if k == 'flags_any' and 'flags_any' in c: c['flags_any_also'] = v   # 觸發已用 flags_any：苦暖區分的「任一」另放一欄
            elif k in c and isinstance(c[k], list): c[k] = c[k] + [x for x in v if x not in c[k]]
            else: c[k] = v
        if social_mid is not None:
            if 'stats_min' in c and 'social' in c['stats_min']: c['stats_min']['social'] = social_mid
            if 'stats_max' in c and 'social' in c['stats_max']: c['stats_max']['social'] = social_mid - 1
        if capped: c['echo_cap_group'] = CAP_GROUP; c['draw_weight'] = weight; caps.add(CAP_GROUP)
        cards.append(c)

cj = json.loads(CARDS.read_text(encoding='utf-8')); lst = cj['cards']; ids = {c['id']: k for k, c in enumerate(lst)}
last_echo = max(k for k, c in enumerate(lst) if c.get('echo_card'))
ZW = '\u200b'
for c in cards:
    if c['id'] in ids:
        old = lst[ids[c['id']]].get('name', '')
        if ZW in old and old.replace(ZW, '') == c['name'].replace(ZW, ''): c['name'] = old   # md 沒有斷點：保留 cards_v12.json 裡文案加的斷點（2cc060c）
        lst[ids[c['id']]] = c
    else: last_echo += 1; lst.insert(last_echo, c)
CARDS.write_text(json.dumps(cj, ensure_ascii=False, indent=2).replace('\u200b', '\\u200b') + '\n', encoding='utf-8')   # 斷點照文案原檔寫成 \\u200b 跳脫

vj = json.loads(V12.read_text(encoding='utf-8')); v_orig = json.dumps(vj, ensure_ascii=False, sort_keys=True)
sa = vj.setdefault('start_adds', []); sa += [c['id'] for c in cards if c['id'] not in sa]
pf = vj.setdefault('play_flags', {}); pf.setdefault('crammed', {'cards': ['d_cram', 's_cram']})
if caps: vj['echo_caps'] = {'_note': '回音牌上限組（echo_cap_group）：同組每局最多幾張（企劃 10/17：19–22 歲六組新回音合計最多兩張）', CAP_GROUP: cap_n}
if caps: vj.setdefault('echo_cap_chance', {'_note': '回音上限組每回合能放進手牌的機率（企劃 10/17：0.4；數值歸企劃）', CAP_GROUP: 0.4})
if caps: vj.setdefault('echo_cooldown', {'_note': '回音冷卻改成 2～3 回合隨機，避免同一學期鎖相（企劃 10/17）', 'groups': ['echo', CAP_GROUP], 'min': 2, 'max': 3})
if caps: vj['echo_cap_from'] = {'_note': '回音上限組最早放進手牌的回合：[年齡, 學期（0 上／1 下）]（企劃 10/17：六組新回音 19 歲下學期起才放）', CAP_GROUP: [19, 1]}
if json.dumps(vj, ensure_ascii=False, sort_keys=True) != v_orig: V12.write_text(json.dumps(vj, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')   # 沒變就不寫，避免攤開企劃的格式
print(f'{len(cards)} 張回音（{rev}）；上限組 {sorted(caps)} 最多 {cap_n} 張、權重 {weight}；social 門檻 {social_mid if social_mid is not None else "md 原值"}')
