// v1.2 牌名斷點（文案 00c1e09）：五字以上的牌名由文案在詞界插 U+200B（零寬空格），手牌牌名配 word-break:keep-all 只在這裡換行。
// U+200B 只給手牌牌名用；其他地方（詳情、回顧、成就、aria-label、比對、當 id）一律先 plainName() 去掉。
export const ZWSP = '\u200b';
export const plainName = (s: string): string => s.replace(/\u200b/g, '');
/** 看得到的字數（去掉 U+200B） */
export const visibleLen = (s: string): number => [...plainName(s)].length;
/** 斷點檢查的門檻：幾個字以上要有 U+200B、每段最多幾個字（手牌 375 寬一行約四字） */
export const NAME_BREAK_MIN = 5, NAME_SEG_MAX = 4, NAME_LINES_MAX = 2;
/** 相鄰兩段合起來不超過幾個字才排在同一行（企劃＋製作 10/17：四字牌名拆 2+2 要真的分兩行，七張手牌才留得住扇形；NAME_SEG_MAX 仍是單段上限） */
export const NAME_JOIN_MAX = 3;
/** 照斷點分行，回傳每一行的字：相鄰段合起來不超過 NAME_JOIN_MAX 字才併成一行；v1.2 手牌有斷點的牌名一律照這個排（企劃 10/17） */
export const splitLines = (s: string): string[] => { const out: string[] = []; for (const seg of s.split(ZWSP)) { if (!seg) continue; const last = out.length - 1; if (last >= 0 && [...out[last]].length + [...seg].length <= NAME_JOIN_MAX) out[last] += seg; else out.push(seg); } return out; };
/** 照 splitLines 的排法要幾行（手牌牌名最多 NAME_LINES_MAX 行） */
export const packLines = (s: string): number => splitLines(s).length;
/** true：有問題就 build／namecheck12 失敗；false：只警告 */
export const NAME_BREAK_STRICT = true; // 企劃 10/17 核可打開（文案已補齊 cards_v12 與凍結檔斷點表）
const envStrict = (): string | undefined => (typeof process !== 'undefined' ? process.env?.NAME_BREAK_STRICT : undefined);
/** NAME_BREAK_STRICT=1／0 環境變數可臨時蓋過上面的預設 */
export const nameBreakStrict = (): boolean => (envStrict() === '1' ? true : envStrict() === '0' ? false : NAME_BREAK_STRICT);
/** v1.2 手牌會出現、但牌在凍結檔（cards.json／cards_adult.json）裡、cards_v12 沒有同 id 覆蓋的牌 */
export function frozenHandCards(frozenFiles: unknown[], v12: unknown): { id: string; name: string }[] {
  const list = (d: unknown) => ((d as { cards?: unknown[] }).cards ?? d) as { id: string; name: string }[];
  const v12ids = new Set(list(v12).map((c) => c.id));
  return frozenFiles.flatMap(list).filter((c) => !v12ids.has(c.id) && typeof c.name === 'string');
}
export interface NameBreakIssue { id: string; path: string; name: string; problem: 'no-break' | 'long-segment' | 'too-many-lines' | 'table-mismatch' | 'table-unknown' }
/** 掃一份牌卡資料裡所有 name 欄位（最上層、variants 的 by_track／by_flag／by_county_tag…、任何巢狀的 name） */
export function nameBreakIssues(cards: { id: string }[]): NameBreakIssue[] {
  const out: NameBreakIssue[] = [];
  const walk = (id: string, x: unknown, path: string) => {
    if (Array.isArray(x)) { x.forEach((y, k) => walk(id, y, `${path}[${k}]`)); return; }
    if (!x || typeof x !== 'object') return;
    for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
      const p = path ? `${path}.${k}` : k;
      if (k === 'name' && typeof v === 'string') {
        const pr = nameProblem(v); if (pr) out.push({ id, path: p, name: v, problem: pr });
      } else if (typeof v === 'object') walk(id, v, p);
    }
  };
  for (const c of cards) walk(c.id, c, '');
  return out;
}
/** 凍結檔牌名的 v1.2 手牌斷點表（data/name_breaks_v12.json，文案 ed107df）：{牌 id: "家裡的｜帳單"}；全形｜轉成 U+200B，_ 開頭的鍵（_note）略過 */
export function parseBreakTable(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {}; if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (!k.startsWith('_') && typeof v === 'string') out[k] = v.replace(/｜/g, ZWSP);
  return out;
}
/** 單一名字的斷點問題（沒有就回 null） */
export function nameProblem(v: string): NameBreakIssue['problem'] | null {
  if (visibleLen(v) >= NAME_BREAK_MIN && !v.includes(ZWSP)) return 'no-break';
  if (v.includes(ZWSP) && v.split(ZWSP).some((seg) => [...seg].length > NAME_SEG_MAX)) return 'long-segment';
  if (v.includes(ZWSP) && packLines(v) > NAME_LINES_MAX) return 'too-many-lines';
  return null;
}
/** 凍結檔（cards.json／cards_adult.json）裡 v1.2 手牌也會出現的牌名：用斷點表的版本檢查；表裡的字去掉斷點要跟牌名一模一樣，表裡的 id 要存在 */
export function frozenNameIssues(frozen: { id: string; name: string }[], table: Record<string, string>): NameBreakIssue[] {
  const out: NameBreakIssue[] = []; const byId = new Map(frozen.map((c) => [c.id, c]));
  for (const c of frozen) { const t = table[c.id];
    if (t !== undefined && plainName(t) !== plainName(c.name)) { out.push({ id: c.id, path: 'name_breaks_v12', name: t, problem: 'table-mismatch' }); continue; }
    const pr = nameProblem(t ?? c.name); if (pr) out.push({ id: c.id, path: t !== undefined ? 'name_breaks_v12' : 'name', name: t ?? c.name, problem: pr }); }
  for (const [id, t] of Object.entries(table)) if (!byId.has(id)) out.push({ id, path: 'name_breaks_v12', name: t, problem: 'table-unknown' });
  return out;
}
export const fmtNameIssue = (i: NameBreakIssue): string => `${i.id} ${i.path}「${i.name.replace(/\u200b/g, '｜')}」${i.problem === 'table-mismatch' ? '去掉斷點後跟牌名不一樣' : i.problem === 'table-unknown' ? '凍結檔裡沒有這張牌' : i.problem === 'no-break' ? '沒有斷點' : i.problem === 'long-segment' ? `有一段超過 ${NAME_SEG_MAX} 字` : `照斷點（相鄰段合計 ${NAME_JOIN_MAX} 字以內才同行）要排 ${packLines(i.name)} 行（手牌最多 ${NAME_LINES_MAX} 行，375 寬會被截掉）`}`;
