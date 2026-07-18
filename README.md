# 紫微拾光 ZIWEI LIGHT（MVP 原型）

紫微斗數 × 正向心理學的每日陪伴 App 原型。以 `ziwei-mvp/` 靜態 mockup 為視覺與文案藍本，
改為 **可實際運行** 的 React 單頁應用：命盤由 [iztro](https://github.com/SylarLong/iztro) 真實排出，
每日日報由本地決定性模板引擎產生（同一天結果恆定），資料全部存在瀏覽器 localStorage，無後端。

## 安裝與執行

```bash
npm install        # 安裝依賴
npm run dev        # 開發伺服器（預設 http://localhost:5173）
npm run build      # 產出正式版到 dist/
npm run preview    # 預覽正式版
npm run test:chart # 驗證 iztro 排盤（scripts/test-chart.mjs）
```

需求：Node 18+（開發時使用 Node 24 驗證）。首次造訪若無個人資料，會自動導向「建立命盤」。

## 技術棧

Vite + React 18（plain JS）+ react-router-dom v6（HashRouter）+ iztro。無 UI 框架、無後端。

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
│   └── daily.js          ★ 本地日報模板引擎（LLM 接入點，見下）
├── components/           TabBar（底部導航）、Toast
└── screens/              Onboarding / Chart / Today / Checkin / Reports /
                          ReportDetail / Subscribe / Timeline / Privacy
```

### 資料存在哪裡（全部 localStorage）

| key | 內容 |
| --- | --- |
| `ziwei.profile` | 暱稱、國曆生日、timeIndex、性別（`genderRaw` 保留原始選項；iztro 用的 `gender` 為二元，「其他／不透露」以「男」計算）、三項同意、建立日期 |
| `ziwei.checkins` | 打卡陣列：`{ date, mood(1–5), emoji, tags[], text }` |
| `ziwei.settings` | 隱私頁三個開關（個人化／推播／匿名統計） |

「我的與隱私」頁可一鍵匯出全部資料（JSON 下載）、確認後永久刪除（清空並回到 onboarding）。

### 日報模板引擎（`src/lib/daily.js`）

- 以 `暱稱|日期|命宮主星` 做種子：FNV-1a 雜湊 → mulberry32 PRNG，**同一天同一人結果恆定**。
- 產出：問候語（依時段）、日柱干支（JDN 公式，已用 2000-01-01=戊午 驗證）、
  能量分 60–95（近 7 日平均心情微調 ±6）、事業/感情/財運三維、行動建議、宜做 chips、
  幸運小物（色/數字/方位）。
- 「給你的一句話」會**回應近 7 日打卡標籤**（如「工作卡關」→ 引用並鼓勵），無打卡時用通用正向文案。
- 硬規則：全部文案皆正向框架，無負面斷言。

### LLM 接入點

未來接真實 LLM 日報 API，**只需改 `src/lib/daily.js` 的 `buildDailyReport()`**：
改為呼叫後端（傳 profile、命宮主星、近 7 日打卡），回傳相同結構的物件，
`src/screens/Today.jsx` 完全不用動。

## 已驗證

- `node scripts/test-chart.mjs`：12 宮、唯一命宮、繁中星曜名（輸出見 scripts 註解）。
- `npm run build` 成功（iztro 資料表使 bundle 約 643 kB，MVP 階段未做 code-split）。
- `npm run dev` 啟動並回應 HTTP 200 後關閉。

## 與 mockup 的差異

- 以 HashRouter 實作路由（純靜態部署免伺服器 rewrite）；網址帶 `#`。
- 省略 mockup 裝飾用的假手機狀態列（9:41 等）。
- 性格測驗（03-quiz）不在本期範圍，命盤頁「下一步」改導向今日日報；隱私頁測驗列亦移除。
- 命盤宮位名以 iztro 輸出為準，其中「僕役」顯示為 mockup 用字「交友」。
- 隱私頁刪除為「立即生效」（本機儲存無法實作 mockup 文案的 7 天緩衝），文案已如實調整。
- 命盤星曜為 iztro 真實計算結果，與 mockup 示意圖的星曜不同屬正常。

內容為自我探索與娛樂用途，不提供醫療、心理治療或投資建議。
