// ============================================================
// 用戶偏好畫像（長期記憶）：讓 AI 一天比一天更懂用戶。
// - 每累積 5 則新打卡，背景叫 /api/profile-summary 滾動更新一段長期畫像
// - 畫像只存 localStorage（維持隱私承諾），之後所有 LLM prompt 注入
// - settings.aiDaily === false → 完全不連網；personalize === false → 不更新也不注入
// ============================================================
import { getSettings, getCheckins, getReports, getProfile } from './storage.js';
import { ASK_CATEGORIES } from './daily.js';

const STORAGE_KEY = 'ziwei.…ile';
const UPDATE_EVERY = 5;
const FETCH_TIMEOUT_MS = 70000;

export function getUserProfile() {
  try {
    const p = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return p && typeof p.text === 'string' ? p : null;
  } catch {
    return null;
  }
}

function saveUserProfile(text, checkinCount) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      text,
      updatedAt: new Date().toISOString(),
      checkinCount,
    }));
  } catch {
    // 容量滿就算了
  }
}

// 給 prompt 注入用：AI 關閉或個人化關閉時回空字串
export function userProfileForPrompt() {
  const settings = getSettings();
  if (settings.aiDaily === false || settings.personalize === false) return '';
  const p = getUserProfile();
  return p ? p.text : '';
}

/**
 * 打卡後呼叫：達到門檻就背景更新畫像（fire-and-forget，不阻塞 UI）。
 */
export async function maybeUpdateUserProfile() {
  const settings = getSettings();
  if (settings.aiDaily === false || settings.personalize === false) return;
  const profile = getProfile();

  const checkins = getCheckins();
  const existing = getUserProfile();
  const sinceCount = existing ? existing.checkinCount : 0;
  if (checkins.length - sinceCount < UPDATE_EVERY) return;

  const recentCheckins = checkins.slice(-10).map((c) => ({
    date: c.date,
    mood: c.mood,
    tags: c.tags || [],
    text: (c.text || '').slice(0, 200),
  }));
  const recentAsks = getReports().slice(0, 5).map((r) => ({
    categoryName: (ASK_CATEGORIES[r.category] || {}).name || '問事',
    question: (r.question || '').slice(0, 100),
  }));

  const payload = {
    nickname: profile.nickname,
    previousProfile: existing ? existing.text : '',
    recentCheckins,
    recentAsks,
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch('/api/profile-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data && typeof data.profile === 'string' && data.profile) {
      saveUserProfile(data.profile, checkins.length);
    }
  } catch {
    // 背景更新失敗就算了，下次打卡再試
  } finally {
    clearTimeout(timer);
  }
}
