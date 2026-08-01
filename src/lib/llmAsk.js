// ============================================================
// AI 問事報告協調層：向 Worker /api/ask-report 取 LLM 解讀。
// - 每個問題獨一無二，不做快取
// - 任何失敗（沒設 key、網路、逾時、格式不符）→ 回 null，ReportDetail 維持本地模板報告
// - 隱私開關：settings.aiDaily === false → 完全不連網（與 AI 日報共用同一個雲端開關）；
//   settings.personalize === false → 不把打卡內容送上雲端
// ============================================================
import { getSettings } from './storage.js';
import { buildHoroscopePayload } from './astro.js';

// 必須大於 worker 的上游逾時（60s），否則上游還在生成前端就先放棄
export const FETCH_TIMEOUT_MS = 70000;

const isValidFields = (r) =>
  r && typeof r === 'object' && typeof r.astrology === 'string' && r.astrology &&
  Array.isArray(r.actions) && r.actions.length > 0;

/**
 * 嘗試取得 LLM 問事報告欄位（astrology / memory / actions）。
 * 回傳 null 代表「不可用」，呼叫端維持本地模板報告。
 */
export async function fetchLlmAskReport({ profile, category, question, recent, now = new Date() }) {
  const settings = getSettings();
  if (settings.aiDaily === false) return null;

  const chartPayload = buildHoroscopePayload(profile, 'both', now);
  const sendCheckins = settings.personalize === false ? [] : recent;
  const payload = {
    ...chartPayload,
    categoryName: category.name,
    categoryPalace: category.palace === '僕役' ? '交友' : category.palace,
    question: (question || '').slice(0, 200),
    recentCheckins: sendCheckins.map((c) => ({
      date: c.date,
      mood: c.mood,
      emoji: c.emoji,
      tags: c.tags || [],
      text: (c.text || '').slice(0, 200),
    })),
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch('/api/ask-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const fields = await res.json();
    if (!isValidFields(fields)) return null;
    return { ...fields, source: 'llm' };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
