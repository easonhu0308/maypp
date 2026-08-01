// ============================================================
// AI 深度命盤解讀協調層：向 Worker /api/chart-report 取 LLM 解讀。
// - 同一張命盤（同人同生日時辰）只呼叫一次（localStorage 快取）
// - 任何失敗（沒設 key、網路、逾時、格式不符）→ 回 null，Chart 頁維持本地格局卡
// - 隱私開關：settings.aiDaily === false → 完全不連網（與 AI 日報共用同一個雲端開關）
// ============================================================
import { getSettings } from './storage.js';
import { buildChartPayload } from './astro.js';

const CACHE_KEY = 'ziwei.chartLLM';
const FETCH_TIMEOUT_MS = 20000;

// 輸入簽名：命盤由生日＋時辰＋性別決定，改名不影響內容但一併納入避免混用
function signature(profile) {
  return [profile.nickname, profile.solarDate, profile.timeIndex, profile.gender].join('|');
}

function readCache(sig) {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    return cache && cache.sig === sig && cache.report ? cache.report : null;
  } catch {
    return null;
  }
}

function writeCache(sig, report) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ sig, report }));
  } catch {
    // 容量滿就算了，下次重進再試
  }
}

const isValidReport = (r) =>
  r && typeof r === 'object' && typeof r.summary === 'string' && r.summary &&
  r.dims && typeof r.dims === 'object';

/**
 * 嘗試取得 LLM 深度命盤解讀。回傳 null 代表「不可用」，Chart 頁照常顯示本地格局卡。
 */
export async function fetchLlmChartReport(profile, now = new Date()) {
  const settings = getSettings();
  if (settings.aiDaily === false) return null;

  const sig = signature(profile);
  const cached = readCache(sig);
  if (cached) return { ...cached, source: 'llm' };

  const payload = buildChartPayload(profile, now);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch('/api/chart-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const report = await res.json();
    if (!isValidReport(report)) return null;
    writeCache(sig, report);
    return { ...report, source: 'llm' };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
