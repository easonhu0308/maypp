// ============================================================
// AI 擇日推薦協調層：向 Worker /api/auspicious 取推薦理由。
// - 本地掃描（auspicious.js）先秒出 3 天與本地理由，LLM 回來後無縫替換
// - 任何失敗 → 回 null，維持本地理由
// - settings.aiDaily === false → 完全不連網
// ============================================================
import { getSettings } from './storage.js';
import { userProfileForPrompt } from './userProfile.js';

export const FETCH_TIMEOUT_MS = 70000;

const isValid = (r) =>
  r && typeof r === 'object' && typeof r.intro === 'string' && r.intro &&
  Array.isArray(r.days) && r.days.length > 0;

/**
 * 嘗試取得 LLM 擇日推薦。回傳 null 代表「不可用」，呼叫端維持本地理由。
 */
export async function fetchLlmAuspicious({ profile, activity, days }) {
  const settings = getSettings();
  if (settings.aiDaily === false) return null;

  const payload = {
    nickname: profile.nickname,
    activityName: activity.name,
    days: days.map((d) => ({ date: d.date, ganzhi: d.ganzhi, hits: d.hits })),
    userProfile: userProfileForPrompt(),
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch('/api/auspicious', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const report = await res.json();
    if (!isValid(report)) return null;
    return { ...report, source: 'llm' };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
