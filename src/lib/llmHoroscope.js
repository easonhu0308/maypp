// ============================================================
// AI 流年/流月解讀協調層：向 Worker /api/horoscope-report 取 LLM 解讀。
// - 一次呼叫同時取「今年」與「本月」（省一次 LLM 請求與等待）
// - localStorage 快取：簽名含「年-月」，跨月自動重取
// - 任何失敗 → 回 null，Chart 頁不顯示此區塊（本命盤內容不受影響）
// - 隱私開關：settings.aiDaily === false → 完全不連網；
//   settings.personalize === false → 不送打卡摘要
// ============================================================
import { getSettings, recentCheckins } from './storage.js';
import { buildHoroscopePayload } from './astro.js';
import { summarizeCheckins } from './daily.js';

const CACHE_KEY = '***';
// 必須大於 worker 的上游逾時（60s）
export const FETCH_TIMEOUT_MS = 70000;

// v1：prompt 或欄位結構改版時遞增，讓舊快取自動失效
function signature(profile, now) {
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return ['v1', profile.nickname, profile.solarDate, profile.timeIndex, profile.gender, ym].join('|');
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
    // 容量滿就算了，下個月再試
  }
}

const isValidReport = (r) =>
  r && typeof r === 'object' &&
  ((r.yearly && r.yearly.theme && r.yearly.text) || (r.monthly && r.monthly.theme && r.monthly.text));

/**
 * 嘗試取得 LLM 流年/流月解讀。回傳 null 代表「不可用」。
 */
export async function fetchLlmHoroscope(profile, now = new Date()) {
  const settings = getSettings();
  if (settings.aiDaily === false) return null;

  const sig = signature(profile, now);
  const cached = readCache(sig);
  if (cached) return { ...cached, source: 'llm' };

  const payload = buildHoroscopePayload(profile, 'both', now);
  if (settings.personalize !== false) {
    payload.memorySummary = summarizeCheckins(recentCheckins(30));
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch('/api/horoscope-report', {
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
