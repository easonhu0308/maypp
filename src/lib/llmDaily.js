// ============================================================
// AI 雲端日報協調層：向 Worker /api/daily 取 LLM 日報。
// - 同一天＋同一份輸入只呼叫一次（localStorage 日缓存）
// - 任何失敗（沒設 key、網路、逾時、格式不符）→ 回 null，呼叫端維持本地模板日報
// - 隱私開關：settings.aiDaily === false → 完全不連網；
//   settings.personalize === false → 不把打卡內容送上雲端
// ============================================================
import { getSettings } from './storage.js';
import { dayGanzhi } from './daily.js';
import { toISODate } from './time.js';
import { userProfileForPrompt } from './userProfile.js';

const CACHE_KEY = 'ziwei.dailyLLM';
const FETCH_TIMEOUT_MS = 65000;

// 輸入簽名：同一天、同一份資料才命中快取；有新打卡就重新生成
function signature(profile, mingStars, recent, iso) {
  const last = recent[0];
  return [
    profile.nickname,
    iso,
    (mingStars || []).join('·'),
    recent.length,
    last ? `${last.date}:${last.mood ?? ''}` : '',
  ].join('|');
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
    // 容量滿就算了，明天再試
  }
}

const isValidFields = (r) =>
  r && typeof r === 'object' && typeof r.lead === 'string' && r.lead &&
  typeof r.encouragement === 'string' && r.encouragement;

/**
 * 嘗試取得 LLM 日報欄位（不含 dateISO/greeting/dayGanzhi，那些由本地計算）。
 * 回傳 null 代表「不可用」，呼叫端照常使用本地模板日報。
 */
export async function fetchLlmDailyFields(profile, mingStars, recent, now = new Date()) {
  const settings = getSettings();
  if (settings.aiDaily === false) return null;

  const iso = toISODate(now);
  const sig = signature(profile, mingStars, recent, iso);
  const cached = readCache(sig);
  if (cached) return { ...cached, source: 'llm' };

  const sendCheckins = settings.personalize === false ? [] : recent;
  const payload = {
    dateISO: iso,
    hour: now.getHours(),
    nickname: profile.nickname,
    gender: profile.genderRaw || profile.gender || '',
    mingStars: mingStars || [],
    dayGanzhi: dayGanzhi(now),
    userProfile: userProfileForPrompt(),
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
    const res = await fetch('/api/daily', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const fields = await res.json();
    if (!isValidFields(fields)) return null;
    writeCache(sig, fields);
    return { ...fields, source: 'llm' };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
