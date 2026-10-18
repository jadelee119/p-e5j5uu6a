#!/usr/bin/env python3
"""從 manifest.json 產生 README 的「每組畫了什麼」表格，貼回 README.md 的 <!-- table --> 區段。"""
import json, os, re
D = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
man = json.load(open(os.path.join(D, 'manifest.json'), encoding='utf-8'))
rows = ['| 組名 | 對應卡片 | 畫面 | 主色 |', '|---|---|---|---|']
for gid, c in man['groups'].items():
    rows.append(f"| `{gid}` | `{c['cards'][0]}`／`{c['cards'][1]}` | {c['subject']} | `{c['accent']}` |")
if man.get('_todo'): rows.append(f"\n還沒畫：{'、'.join(man['_todo'])}（找不到圖時走實心缺圖樣式）。")
p = os.path.join(D, 'README.md'); s = open(p, encoding='utf-8').read()
s = re.sub(r'<!-- table -->.*<!-- /table -->', '<!-- table -->\n' + '\n'.join(rows) + '\n<!-- /table -->', s, flags=re.S)
open(p, 'w', encoding='utf-8').write(s)
