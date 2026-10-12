# 屬性條 v1（不顯示數字）— 給遊戲工程師的整合說明

檔案：`stat-bars.css`（樣式）、`mockup.html`（示意，內含 6 個 SVG 圖示與標籤表，可直接複製）、`mockup.png`（淺／深色並排）。
沒有修改任何遊戲程式；現在的 HUD 在 `game/src/main.ts` 的 `statsHtml()`（第 44–47 行），樣式在 `game/src/style.css` 第 11–15 行（`.stats` `.bar`）。

## 1. 載入
1. 在 `theme.css`、`dark.css` 之後載入 `stat-bars.css`。
2. 頁面放一次蠟筆濾鏡（給長條毛邊）：
```html
<svg width="0" height="0" style="position:absolute"><filter id="sb-crayon"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7"/><feDisplacementMap in="SourceGraphic" scale="2.2"/></filter></svg>
```
3. 深色模式跟現有一樣看 `:root[data-theme="dark"]`，不用另外處理。

## 2. 標記（取代現在的 `<div>名稱 數字<div class="bar">`）
```html
<div class="sb-grid">
  <div class="sb sb-academic [is-danger]" data-lv="1..5" role="img" aria-label="學業：不錯">
    <span class="sb-icon"><svg ...>(ICONS.academic)</svg></span>
    <div class="sb-head"><span class="sb-name">學業</span><span class="sb-label">不錯</span></div>
    <div class="sb-bar"><i></i></div>
  </div>
</div>
```
長條寬度由 `data-lv` 決定（20% 一格），**不要再寫 `style="width:${s[k]}%"`**，否則玩家可以從寬度反推數字。
stat class：`sb-academic` `sb-happiness` `sb-stress` `sb-health` `sb-social` `sb-wealth`；危險加 `is-danger`。

## 3. 標籤門檻（建議放資料檔，如 `data/stat_labels.json`，不寫死）
數值 0–100。等級 = 第一個 `value >= min` 的門檻（由高往低找）。
```json
{
  "academic":  {"mins":[0,20,40,60,80], "labels":["很差","偏弱","普通","不錯","頂尖"],         "danger":{"below":20}},
  "happiness": {"mins":[0,20,40,60,80], "labels":["崩潰邊緣","悶悶的","還過得去","開心","超爽"], "danger":{"below":20}},
  "stress":    {"mins":[0,20,40,60,80], "labels":["很放鬆","輕鬆","有點緊","快炸了","爆表"],     "danger":{"atLeast":70}, "inverted":true},
  "health":    {"mins":[0,20,40,60,80], "labels":["病懨懨","虛虛的","普通","健壯","生龍活虎"],   "danger":{"below":20}},
  "social":    {"mins":[0,20,40,60,80], "labels":["邊緣人","沒什麼朋友","普通","人緣好","人氣王"], "danger":{"below":20}},
  "wealth":    {"mins":[0,15,30,40,70], "labels":["拮据","吃緊","普通","寬裕","優渥"],           "danger":{"below":15}}
}
```
- **壓力是反向**：條越長越糟，`inverted: true` 只影響危險判定（高 = 危險）；長條仍是「越多越長」。門檻 70 沿用現在 `.bar.stress.hot` 的值。
- **家庭資源**：保留 core-loop §16 的 拮据/普通/寬裕/優渥 與 15/40/70 門檻，只在 15–29 多切一格「吃緊」湊成 5 格；若企劃不要新增，改成 4 格（`data-lv` 用 1、3、4、5）即可。
- 危險門檻 20 是美術提案，請 @遊戲企劃 依結局條件確認（例如健康過低觸發的結局）。

## 4. 動畫與無障礙
- 危險：填色變暖紅 `--sb-danger`、長條與圖示左右晃 2px（0.5s × 3 次），之後只有輕微外框呼吸；標籤後加紅色「!」，所以不靠顏色也看得出來。
- `prefers-reduced-motion: reduce` 時關掉晃動與寬度過場。
- 文字（名稱、標籤）一律用 `--ink`：淺色約 13:1、深色約 11:1，過 WCAG AA。屬性色只用於圖示與填色。
- 每格 `role="img"` + `aria-label="學業：不錯"`，螢幕閱讀器讀到的也不是數字。

## 5. 色票
| 屬性 | 淺色 | 深色 | 圖示 |
|---|---|---|---|
| 學業 | #3E6FB0 作業簿藍 | #7FA8E0 | 打開的課本 |
| 快樂 | #E39B2D 橘子汽水 | #F2B85A | 笑臉 |
| 壓力 | #8A5BA8 瘀青紫 | #B794D0 | 冒汗的烏雲 |
| 健康 | #4E9A5B 芭樂綠 | #86C68F | 心＋心電圖 |
| 關係 | #D9668A 紅豆餅粉 | #EE93B0 | 兩個人 |
| 家庭資源 | #B08A3E 舊銅板金褐 | #D6B46A | 錢包／提包 |
| 危險 | #D2452F | #FF7A63 | — |

`style.css` 的舊 `.stats` `.bar` 規則替換完 HUD 後可刪；結局畫面也呼叫 `statsHtml()`，會一起換掉。
