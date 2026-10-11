# 台灣人生 Roguelike 模擬器：MVP 網頁版

## 執行
```bash
npm install
npm run dev      # 開發伺服器 http://localhost:5173（--host，區網可連）
npm run build    # 型別檢查 + 打包到 dist/
npm run sim      # 無頭模擬 1000 輪，印出結局分布；可帶參數：npm run sim -- 5000 42（輪數、種子）
```
固定種子試玩：在網址加上 `?seed=123`。

## 架構
- `src/logic/`：純 TS 遊戲邏輯，不碰 DOM，瀏覽器和 sim 共用
  - `engine.ts`：開局（§6）、16 回合表、AP 行動（§4）、事件抽取、分岔（§5）、強制事件（§3）、階段總結、結局（§7）、人生回顧（§11）
  - `types.ts`、`rng.ts`（mulberry32 種子亂數）、`load.ts`、`counties.ts`（counties.json 尚未產出時用的**暫代**縣市表）
- `src/main.ts` + `style.css`：介面
- `src/data.ts`：以 Vite alias `@data`、`@writing` 直接讀 `../data`、`../writing`，資料只有一份，不複製
  - `data/events/*.json` 全部自動載入；`data/counties.json` 存在就用，不存在就用暫代表
- `sim/sim.ts`：隨機策略模擬

## 平衡參數（v0.3）
所有數值讀自 `data/balance.json`（行動效果、每回合被動流失、被動家庭資源、結局條件、regret 高低門檻 10）。
balance.json 尚未定義的鍵由 `src/logic/balance.ts` 的 `DEFAULT_BALANCE` 補上（§3/§6 規格值）：每階段 AP、崩潰門檻（壓力 ≥ 90）與效果（健康 −15、快樂 −20，下回合 AP −1）、病倒門檻（健康 ≤ 10）、所得分位表、分位偏移強度 α=2、初始屬性。balance.json 有同名鍵時會覆蓋預設值。

- 經濟壓力：每回合被動結算後，家庭資源低於 `passive_per_turn.poverty_pressure.wealth_below` 時套用其 effects（v0.4）。
- 縣市：`data/counties.json`；檔案不存在時才用暫代表。
- 階段旁白：`writing/stage_narrations.md`，依「## 階段名」切段，代入 `{county}`、`{album_caption}` 等變數。
- 回合表 `TURNS` 在 engine.ts：B1 在 9 歲，B3 在 17 歲，B2、B4 各有專屬回合。
- 看山三境：讀 endings.json 的 `condition`，依 `condition.priority` 由小到大判定。
- `npm run sim` 會輸出：結局分布、遺憾變體、看山三境、出生縣市 × 結局、所得分位 × 結局、縣市專屬卡觸發率、balance.json 鍵名檢查。

## 部署（GitHub Pages）
- 正式版打包會把 `data/`、`writing/` 的內容一起打進 JS，`dist/` 是完全靜態的網站，不需要開發伺服器。
- 子路徑：`BASE_PATH=/<repo>/ npm run build`（預設 `/`）。
- 專案根目錄的 `.github/workflows/deploy.yml` 會在 push 到 `main` 時建置 `game/`（BASE_PATH 自動設為 `/<repo 名稱>/`）、跑一次 200 輪 sim 當煙霧測試，再用 actions/deploy-pages 部署。repo 的 Settings → Pages → Source 要選「GitHub Actions」。

## 美術主題
- `src/theme.css` 從 `art/theme.css` 複製而來，要改色請改 art/ 那份再重新複製；`style.css` 只用其中的變數。
- 字型：Noto Serif TC 和 Noto Sans TC 由 theme.css 從 Google Fonts 載入；jf open 粉圓 2.1（SIL OFL）放在 `public/fonts/`，自行轉成 woff2（約 2.1 MB），授權檔一起附上。
- 截圖：`screenshots/`

## 插圖
- 來源：`art/generated/manifest.json`（event_id → 圖檔）。`npm run images`（dev 和 build 前會自動執行）會把每張圖轉成 webp（寬 ≤ 800px、quality 80），放到 `game/.illustrations/`（已 gitignore，不改 art/ 原檔）。
- 美術重畫同名檔案後重新 build 就會換上新圖；manifest 新增或移除的圖也會自動同步。沒有插圖的事件卡就不顯示圖片。
- 開局插圖（選用）：manifest 鍵名 `opening_q1` … `opening_q5`，依玩家所得分位顯示在開局畫面；沒有就不顯示。
- 事件卡上方顯示拍立得相紙；人生回顧相簿每階段一張拍立得（沒有插圖時顯示斜紋空白相紙），最後一格是「22 歲以後」的空白相框。
