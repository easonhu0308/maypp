# 懂你紫微 DONGNI ZIWEI（MVP 原型）

紫微斗數 × 正向心理學的每日陪伴 App 原型。以 `ziwei-mvp/` 靜態 mockup 為視覺與文案藍本，
改為 **可實際運行** 的 React 單頁應用：命盤由 [iztro](https://github.com/SylarLong/iztro) 真實排出，
每日日報由 Cloudflare Worker 產生（線上走 **Workers AI qwen3**、本機開發可走 Moonshot Kimi；未設 key 或斷線時降級為本地決定性模板引擎），
資料全部存在瀏覽器 localStorage，無自有資料庫。

## 安裝與執行

```bash
npm install        # 安裝依賴
npm run dev        # 開發伺服器（預設 http://localhost:5173，/api 由插件在本機跑 worker）
npm run build      # 產出正式版到 dist/（client/ + worker）
npm run preview    # 預覽正式版（build + wrangler dev）
npm run deploy     # 部署到 Cloudflare Workers（build + wrangler deploy）
npm run test:chart # 驗證 iztro 排盤（scripts/test-chart.mjs）
npm run test:llm   # 驗證 LLM 日報 prompt/正規化/降級（scripts/test-llm-daily.mjs）
```

需求：Node 18+（開發時使用 Node 24 驗證）。首次造訪若無個人資料，會自動導向「建立命盤」。

## 技術棧

Vite + React 18（plain JS）+ react-router-dom v6（HashRouter）+ iztro + Cloudflare Workers（@cloudflare/vite-plugin）。無 UI 框架、無自有資料庫。

## 架構

```
src/
├── App.jsx               路由 + 未建檔導向 /onboarding 的守門（RequireProfile）
├── styles.css            沿用 ziwei-mvp/style.css 的設計系統（夜空 × 紫金）
├── lib/
│   ├── storage.js        localStorage 持久層（見下）
│   ├── time.js           時辰對照（子=0 … 亥=11 → iztro timeIndex）、日期格式化
│   ├── astro.js          iztro 排盤封裝、4×4 宮位盤的地支佈局、星曜行整理
│   ├── geju.js           「一句話看懂你的格局」：命宮主星組合查表（8 組合 + 單星 + 通用兜底）
│   ├── daily.js          本地日報模板引擎（AI 日報失效時的降級方案）
│   └── llmDaily.js       ★ AI 雲端日報協調層（日缓存＋降級，見下）
├── components/           TabBar（底部導航）、Toast
└── screens/              Onboarding / Chart / Today / Checkin / Reports /
                          ReportDetail / Subscribe / Timeline / Privacy
worker/
└── index.js              ★ Cloudflare Worker：/api/daily 日報、/api/chart-report 深度解讀
                            （上游 Workers AI 優先、Moonshot HTTP 備用）、/api/health、靜態 SPA
```

### 資料存在哪裡（全部 localStorage）

| key | 內容 |
| --- | --- |
| `ziwei.profile` | 暱稱、國曆生日、timeIndex、性別（`genderRaw` 保留原始選項；iztro 用的 `gender` 為二元，「其他／不透露」以「男」計算）、三項同意、建立日期 |
| `ziwei.checkins` | 打卡陣列：`{ date, mood(1–5), emoji, tags[], text }` |
| `ziwei.settings` | 隱私頁四個開關（個人化／AI 雲端日報／推播／匿名統計） |
| `ziwei.dailyLLM` | 當日 AI 日報快取（輸入簽名不符即重取） |

「我的與隱私」頁可一鍵匯出全部資料（JSON 下載）、確認後永久刪除（清空並回到 onboarding）。

### 日報模板引擎（`src/lib/daily.js`）

- 以 `暱稱|日期|命宮主星` 做種子：FNV-1a 雜湊 → mulberry32 PRNG，**同一天同一人結果恆定**。
- 產出：問候語（依時段）、日柱干支（JDN 公式，已用 2000-01-01=戊午 驗證）、
  能量分 60–95（近 7 日平均心情微調 ±6）、事業/感情/財運三維、行動建議、宜做 chips、
  幸運小物（色/數字/方位）。
- 「給你的一句話」會**回應近 7 日打卡標籤**（如「工作卡關」→ 引用並鼓勵），無打卡時用通用正向文案。
- 硬規則：全部文案皆正向框架，無負面斷言。

### AI 雲端日報（2026-08-01 起：線上 Workers AI）

- **上游分兩層**（`worker/index.js` 的 `callLlm()`）：
  - 有 `AI` binding（線上）→ **Cloudflare Workers AI `@cf/qwen/qwen3-30b-a3b-fp8`**（免費額度、低延遲）。
    為什麼不是 Kimi：api.kimi.com 對 serverless 出口回 403 JS 挑戰頁、api.moonshot.ai 直接掛起，
    兩者都是 Cloudflare 前門且拒服務 Workers 流量（2026-08-01 實測）。
  - 無 binding（本機開發）→ Moonshot HTTP（`MOONSHOT_BASE`/`MOONSHOT_MODEL` vars 可改），
    本地 preview 可用真 Kimi 日報（`.dev.vars` 填 key）。
- `POST /api/daily` 把命盤主星＋近 7 日打卡摘要產生日報 JSON（另有 `POST /api/chart-report` 深度命盤解讀）；
  `GET /api/health` 回報 `llmBackend`（workers-ai | moonshot-http | none）。
- 前端 `src/lib/llmDaily.js`：先秒開本地模板日報，背景取 LLM 版後無縫替換（Today 標題列會多出 `· AI` 標記）；
  同一份輸入一天只呼叫一次（`ziwei.dailyLLM` 日缓存）。
- 降級：沒設 key / 逾時 / 上游錯誤 / 格式不符 → 靜默使用本地模板引擎，App 永遠可用。
- 隱私：隱私頁新增「AI 雲端日報」開關（預設開），關閉則完全不連網；
  關閉「個人化內容生成」時打卡內容不送上雲端。
- Moonshot key（本機用）只存在 `.dev.vars`（本機）與 Cloudflare secret（線上 fallback），前端拿不到。
- 部署走 @cloudflare/vite-plugin 產生的設定：`npm run preview` / `npm run deploy`
  （＝ build 後對 `dist/maypp/wrangler.json` 執行 wrangler；直接對根目錄 wrangler.jsonc 跑 wrangler 是錯的）。
- ⚠️ /api/daily 目前無身分驗證，知道網址的人都能呼叫（會耗 Workers AI 免費額度）。
  朋友圈 MVP 可接受；對外開放前應加 Turnstile 或 rate limit。

## 已驗證

- `node scripts/test-chart.mjs`：12 宮、唯一命宮、繁中星曜名（輸出見 scripts 註解）。
- `node scripts/test-llm-daily.mjs`：18 項（prompt 組裝、JSON 萃取、正規化 clamp、本地降級恆定）。
- `npm run build` 成功（iztro 資料表使 bundle 約 671 kB，MVP 階段未做 code-split）。
- `npm run dev` 啟動並回應 HTTP 200；`/api/health` 經插件正確路由到 worker。
- `npm run preview`（wrangler dev）：`/` 與 SPA fallback 200、`POST /api/daily` 無 key 時 501、
  `GET /api/daily` 405（2026-07-28 於 Node 24 驗證；LLM 實呼待正式 key 測試）。

## 與 mockup 的差異

- 以 HashRouter 實作路由（純靜態部署免伺服器 rewrite）；網址帶 `#`。
- 省略 mockup 裝飾用的假手機狀態列（9:41 等）。
- 性格測驗（03-quiz）不在本期範圍，命盤頁「下一步」改導向今日日報；隱私頁測驗列亦移除。
- 命盤宮位名以 iztro 輸出為準，其中「僕役」顯示為 mockup 用字「交友」。
- 隱私頁刪除為「立即生效」（本機儲存無法實作 mockup 文案的 7 天緩衝），文案已如實調整。
- 命盤星曜為 iztro 真實計算結果，與 mockup 示意圖的星曜不同屬正常。

內容為自我探索與娛樂用途，不提供醫療、心理治療或投資建議。
