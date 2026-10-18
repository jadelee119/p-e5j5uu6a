// v1.2 凍結檔牌名的手牌斷點表（文案 ed107df：data/name_breaks_v12.json，{牌 id: "家裡的｜帳單"}；全形｜→ U+200B）。
// 只改 v1.2 手牌牌名的換行位置；沒有這個檔＝什麼都不做（glob 找不到就是空表）。v1.1 不讀。
import { parseBreakTable, plainName } from './logic/names';
const mods = import.meta.glob('../../data/name_breaks_v12.json', { eager: true, import: 'default' });
export const nameBreakTable: Record<string, string> = parseBreakTable(Object.values(mods)[0]);
/** 表裡的字去掉斷點要跟牌名一樣，不一樣（或牌不存在）就在主控台警告，那筆不套用 */
export function checkBreakTable(nameOf: (id: string) => string | undefined): void {
  for (const [id, t] of Object.entries(nameBreakTable)) { const n = nameOf(id);
    if (n === undefined) console.warn(`name_breaks_v12：沒有 ${id} 這張牌`);
    else if (plainName(t) !== plainName(n)) console.warn(`name_breaks_v12：${id}「${plainName(t)}」跟牌名「${plainName(n)}」不一樣，不套用`); }
}
/** v1.2 手牌牌名的斷點版本：表裡有、而且去掉斷點跟現在顯示的牌名（含出生年等變體）一樣才用 */
export const handBreakName = (id: string, shown: string): string | undefined => { const t = nameBreakTable[id]; return t !== undefined && plainName(t) === shown ? t : undefined; };
