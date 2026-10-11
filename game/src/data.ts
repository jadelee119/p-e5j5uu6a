// 瀏覽器端資料載入：直接 import ../data 與 ../writing（單一資料來源，不複製）
import { buildGameData } from './logic/load';
import endings from '@data/endings.json';
import narrationMd from '@writing/stage_narrations.md?raw';
import balance from '@data/balance.json';
import birthYears from '@data/birth_years.json';
import eraTerms from '@data/era_terms.json';

const eventMods = import.meta.glob('@data/events/*.json', { eager: true, import: 'default' });
// counties.json 可能尚未存在：glob 找不到檔案時回傳空物件 → 使用 fallback
const countyMods = import.meta.glob('@data/counties.json', { eager: true, import: 'default' });

export const gameData = buildGameData({
  eventFiles: Object.values(eventMods),
  endings,
  countiesJson: Object.values(countyMods)[0],
  balance,
  birthYears,
  eraTerms,
  narrationMd,
});
