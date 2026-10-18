#!/usr/bin/env python3
"""writing/v1.2_era_cards_text.md → data/deck/era_cards.json（name、variants、album_text、review_line）、
data/deck/scenes.json（場景版本、school_choice_text）、data/deck/v12.json（play_notes）。
文案改了就重跑：python3 game/scripts/era-text-from-md.py（只改文字欄位，不動數值）。"""
import json, re, sys
from pathlib import Path
root = Path(__file__).resolve().parents[2]
md = (root / 'writing/v1.2_era_cards_text.md').read_text()

# 1. 表格列：| 鍵（括號說明）| 文字 | [文字2] |
def strip_v(t):
    """拿掉出處標記「（V-01）」「（V-19、V-20）」，不上畫面"""
    return re.sub(r'（V-[0-9][^）]*）', '', t).strip()
rows = {}
for ln in md.splitlines():
    m = re.match(r'^\|\s*([a-z_0-9]+(?:\.[a-z_0-9]+)+)[^|]*\|(.*)\|\s*$', ln)
    if not m: continue
    cells = [strip_v(c) for c in m.group(2).split('|')]
    rows[m.group(1)] = cells
# system_rules 表：| 規則 | 鍵 | 文字 | 備註 |（鍵在第二欄）
for ln in md.splitlines():
    cells = [c.strip() for c in ln.strip().strip('|').split('|')] if ln.startswith('|') else []
    if len(cells) >= 3 and re.fullmatch(r'[a-z_0-9]+(?:\.[a-z_0-9]+)+', cells[1]) and not re.fullmatch(r'[a-z_0-9]+(?:\.[a-z_0-9]+)+.*', cells[0]):
        rows[cells[1]] = [strip_v(c) for c in cells[2:]]
# 回顧一行：| rev_xxx | 句子 | 備註 |
revs = {}
for ln in md.splitlines():
    m = re.match(r'^\|\s*(rev_[a-z_0-9]+)\s*\|([^|]+)\|', ln)
    if m: revs[m.group(1)] = strip_v(m.group(2))
# 2. 每張牌的 name／album_text／review_line（各節標題下的條列）
meta = {}; cur = None
for ln in md.splitlines():
    h = re.match(r'^###\s+(era_[a-z_0-9]+)(?:（name：([^）]+)）)?', ln)
    if h:
        cur = h.group(1); meta.setdefault(cur, {})
        if h.group(2): meta[cur]['name'] = h.group(2).split('，')[0]
        continue
    if ln.startswith('## '): cur = None
    if not cur: continue
    for k in ('name', 'album_text', 'review_line'):
        m = re.match(rf'^- {k}：(.+)$', ln)
        if m: meta[cur][k] = strip_v(m.group(1))

def need(k):
    if k not in rows: sys.exit(f'文案裡找不到鍵 {k}')
    return rows[k]
def pro(k, **cond):
    c = need(k); return {'by_prologue': True, **cond, 'line': c[0], 'consequence': c[1]}
def turn(k, **cond):
    return {'by_prologue': False, **cond, 'line': need(k)[0]}

V = {
 'era_921': [pro('era_921.heavy.preschool', by_tier='heavy', by_birth_year=[83, 83]), pro('era_921.light.preschool', by_tier=['light', 'tv'], by_birth_year=[83, 83]),
             pro('era_921.heavy.prologue', by_tier='heavy'), pro('era_921.light.prologue', by_tier=['light', 'tv'])],
 'era_nari': [pro('era_nari.heavy.prologue', by_tier='heavy'), pro('era_nari.light.prologue', by_tier='light')],
 'era_sars': [pro('era_sars.heavy.prologue', by_tier='heavy'), pro('era_sars.light.prologue', by_tier=['light', 'tv'])],
 'era_hsr': [pro('era_hsr.all.prologue'), turn('era_hsr.light.turn', by_tier=['light', 'heavy']), turn('era_hsr.tv.turn', by_tier='tv')],
 'era_crisis': [pro('era_crisis.q123.prologue', by_quintile=[1, 2, 3]), pro('era_crisis.q45.prologue', by_quintile=[4, 5]),
                # q1_rare：企劃核准（設計假設）Q1 限定，權重是 Q1 版的 0.3 倍（Q1 約四分之一看到）；數值、旗標同 q123
                turn('era_crisis.q1_rare.turn', by_quintile=[1], weight=0.3, _note='設計假設：權重 0.3（相對 q123 版 1.0）'),
                turn('era_crisis.q123.turn', by_quintile=[1, 2, 3], weight=1), turn('era_crisis.q45.turn', by_quintile=[4, 5])],
 'era_voucher': [pro('era_voucher.all.prologue'), turn('era_voucher.all.turn')],
 'era_morakot': [pro('era_morakot.heavy.prologue', by_tier='heavy'), pro('era_morakot.all.prologue'),
                 turn('era_morakot.heavy.turn', by_tier='heavy'), turn('era_morakot.light.turn', by_tier='light'), turn('era_morakot.tv.turn', by_tier='tv')],
 # 太陽花：heavy 一句不分學段（by_flag era_sunflower_heavy 排最前）；tv 依學段：出社會＞大學＞五專 19–20＞高中 16–18＞國中 13–15
 'era_sunflower': [{'by_flag': 'era_sunflower_heavy', 'line': need('era_sunflower.heavy')[0]},
                   {'by_flag': 'work_first', 'line': need('era_sunflower.tv.work')[0]},
                   {'by_flag': ['uni', 'uni_tech'], 'line': need('era_sunflower.tv.college')[0]},
                   {'by_track': 'hs_5yr', 'by_age': [16, 20], 'line': need('era_sunflower.tv.senior')[0]},
                   {'by_age': [16, 18], 'line': need('era_sunflower.tv.senior')[0]},
                   {'by_age': [13, 15], 'line': need('era_sunflower.tv.junior')[0]},
                   {'line': need('era_sunflower.tv.senior')[0]}],
 'era_flexday': [{'by_flag': ['worked_teen', 'worked_uni'], 'line': need('era_flexday.working')[0]}, {'by_track': 'work_first', 'line': need('era_flexday.working')[0]}, {'line': need('era_flexday.family')[0]}],
 'era_covid': [{'by_term': 0, 'line': need('era_covid.fall')[0]}, {'by_term': 1, 'line': need('era_covid.spring')[0]}],
 'era_covid_lv3': [{'by_tier': 'heavy', 'line': need('era_covid_lv3.heavy')[0]}, {'by_tier': ['light', 'tv'], 'line': need('era_covid_lv3.light')[0]}],
}
p = root / 'data/deck/era_cards.json'; d = json.loads(p.read_text())
for c in d['cards']:
    m = meta.get(c['id'], {})
    if 'name' not in m: sys.exit(f'{c["id"]} 沒有 name')
    c['name'] = m['name']; c['album_text'] = m.get('album_text', ''); c['review_line'] = m.get('review_line', '')
    c['variants'] = V[c['id']]; c['line'] = V[c['id']][-1]['line']; c.pop('todo_writer', None)
for r in d['review_only']:
    if r['id'] not in revs: sys.exit(f'回顧一行 {r["id"]} 沒有文字')
    r['review_line'] = revs[r['id']]
d['_text_source'] = 'writing/v1.2_era_cards_text.md（game/scripts/era-text-from-md.py 轉入）'
p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + '\n')

# 場景版本與選校句
sp = root / 'data/deck/scenes.json'; s = json.loads(sp.read_text()); sc = s['scenes']
def dropv(scene, flag):
    sc[scene]['variants'] = [x for x in sc[scene].get('variants', []) if x.get('by_flag') != flag]
dropv('sc_school_start', 'morakot_delay')  # 4d5e95a：開學延後的場景拿掉
def setv(scene, v):
    vs = sc[scene].setdefault('variants', []); key = json.dumps({k: v[k] for k in v if k != 'text'}, sort_keys=True)
    vs[:] = [x for x in vs if json.dumps({k: x[k] for k in x if k != 'text'}, sort_keys=True) != key]; vs.insert(0, v)
setv('sc_school_start', {'by_flag': 'curr9_junior', 'by_age': [13, 13], 'text': need('sc_school_start.curr9_junior')[0]})
setv('sc_graduation', {'by_flag': 'grad_cancelled', 'text': need('sc_graduation.grad_cancelled')[0]})
setv('sc_mock_exam', {'by_flag': 'star_plan', 'by_track': 'hs_general', 'by_age': [18, 18], 'text': need('sc_mock_exam.hs_general.star_plan')[0]})
setv('sc_mock_exam', {'by_flag': 'star_recommend', 'by_track': 'hs_general', 'by_age': [18, 18], 'text': need('sc_mock_exam.hs_general.star_rec')[0]})
sc['school_choice_text'] = {'_note': '選校畫面的學費句（era-cards §6）；DeckGame.choiceNote(key) 選用。私立普高句企劃定案不做，不轉入', 
  'tuition_114_vocational': need('school_choice.tuition_114.vocational')[0],
  'tuition_148': need('school_choice.tuition_148')[0], 'tuition_neutral': need('school_choice.tuition_neutral')[0]}
sp.write_text(json.dumps(s, ensure_ascii=False, indent=2) + '\n')

vp = root / 'data/deck/v12.json'; v = json.loads(vp.read_text())
# v12.json 是企劃的檔：只更新 play_notes 的文字；play_flags 只在缺少時補預設，不覆蓋企劃後加的旗標（如 crammed）。
# 內容沒變就不寫檔，避免把企劃手排的格式攤開。
orig = json.dumps(v, ensure_ascii=False, sort_keys=True)
v['play_notes'] = {'_note': '每局第一次打這張牌時多一句旁白（era-cards §6 基本工資）', 's_work': [
  {'by_flag': 'wage_frozen', 'text': need('s_work.wage_frozen')[0]}, {'by_flag': 'wage_rising', 'text': need('s_work.wage_rising')[0]}]}
pf = v.setdefault('play_flags', {'_note': '打過這些牌就加旗標（企劃定案）'})
pf.setdefault('worked_teen', {'cards': ['s_work']}); pf.setdefault('worked_uni', {'cards': ['uni_parttime', 'tech_parttime']})
if json.dumps(v, ensure_ascii=False, sort_keys=True) != orig:
    vp.write_text(json.dumps(v, ensure_ascii=False, indent=2) + '\n'); print('v12.json play_notes 已更新（格式會被重排，提交前請企劃看 diff）')
print('ok', len(d['cards']), 'cards', len(revs), 'review lines')
