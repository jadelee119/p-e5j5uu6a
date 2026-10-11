import type { BirthYear, EraSegment, GameData, GameEvent, EndingsData, StageId } from './types';
import { buildBalance } from './balance';
import { FALLBACK_COUNTIES, normalizeCounties } from './counties';

/** 從 Markdown 樣板取出 blockquote 內文（> 開頭的行） */
const STAGE_HEADINGS: [RegExp, StageId][] = [[/幼兒/, 'infant'], [/小學/, 'elementary'], [/國中/, 'junior'], [/高中/, 'senior'], [/青年/, 'adult']];
/** 解析 stage_narrations.md：每個「## 階段名」底下的 blockquote */
export function parseStageNarrations(md: string): Partial<Record<StageId, string>> {
  const out: Partial<Record<StageId, string>> = {};
  for (const sec of md.split(/^## /m).slice(1)) {
    const head = sec.split('\n')[0];
    const st = STAGE_HEADINGS.find(([re]) => re.test(head))?.[1];
    if (st) out[st] = parseNarrationMd(sec);
  }
  return out;
}
export function parseNarrationMd(md: string): string {
  return md.split('\n').filter((l) => l.startsWith('>')).map((l) => l.replace(/^>\s?/, '')).join('\n').trim();
}

/** 由原始資料組成 GameData（瀏覽器與 sim 共用） */
export function buildGameData(raw: {
  eventFiles: unknown[]; endings: unknown; balance: unknown; birthYears?: unknown; eraTerms?: unknown; opening?: unknown; countiesJson?: unknown; narrationMd: string;
}): GameData {
  const events: GameEvent[] = raw.eventFiles.flatMap((f: any) => (Array.isArray(f) ? f : f?.events ?? []));
  const parsed = raw.countiesJson !== undefined ? normalizeCounties(raw.countiesJson) : null;
  const narration = parseStageNarrations(raw.narrationMd);
  return {
    balance: buildBalance(raw.balance),
    birthYears: ((raw.birthYears as any)?.birth_years ?? []) as BirthYear[],
    eraTerms: ((raw.eraTerms as any)?.by_birth_year ?? []) as EraSegment[],
    opening: ((raw.opening as any)?.by_quintile ?? {}) as Record<string, string>,
    events, endings: raw.endings as EndingsData,
    counties: parsed ?? FALLBACK_COUNTIES, countiesSource: parsed ? 'counties.json' : 'fallback', narration,
  };
}
