// v1.2 牌名斷點檢查（npm run namecheck12；build 時 vite 的 name-breaks 外掛跑同一套）：
//  1. data/deck/cards_v12.json 所有 name（含 by_track／by_flag／by_county_tag 等 variants）
//  2. 凍結檔（cards.json／cards_adult.json）裡 v1.2 手牌也會出現的牌名，用 data/name_breaks_v12.json 的斷點版本（表裡去掉斷點要跟牌名一樣）
// 規則：五字以上要有斷點、每段最多四字、照斷點每行四字排最多兩行。NAME_BREAK_STRICT（names.ts，預設 true；環境變數 NAME_BREAK_STRICT=0／1 可蓋過）時有問題就 exit 1。
import { readFileSync, existsSync } from 'node:fs';
import { nameBreakIssues, frozenNameIssues, frozenHandCards, parseBreakTable, fmtNameIssue, nameBreakStrict } from '../src/logic/names';
const root = new URL('../../data/', import.meta.url); const rd = (f: string) => JSON.parse(readFileSync(new URL(f, root), 'utf8'));
const tablePath = new URL('name_breaks_v12.json', root); const table = existsSync(tablePath) ? parseBreakTable(JSON.parse(readFileSync(tablePath, 'utf8'))) : {};
const v12 = rd('deck/cards_v12.json');
const a = nameBreakIssues(v12.cards ?? v12); const b = frozenNameIssues(frozenHandCards([rd('deck/cards.json'), rd('deck/cards_adult.json')], v12), table);
const strict = nameBreakStrict();
console.log(`牌名斷點：cards_v12.json ${a.length} 個問題；凍結檔（斷點表 ${existsSync(tablePath) ? Object.keys(table).length + ' 筆' : '沒有檔案'}）${b.length} 個問題${a.length + b.length && !strict ? '（警告，NAME_BREAK_STRICT 關閉）' : ''}`);
for (const i of [...a, ...b]) console.log('  ' + fmtNameIssue(i));
if (a.length + b.length && strict) { console.log('NAME_BREAK_STRICT：失敗'); process.exit(1); }
