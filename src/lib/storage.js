// localStorage 持久層：profile / checkins / settings，全部只存在使用者的瀏覽器裡。
import { toISODate, parseISODate } from './time.js';

const KEY_PROFILE = 'ziwei.profile';
const KEY_CHECKINS = 'ziwei.checkins';
const KEY_SETTINGS = 'ziwei.settings';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// --- 個人資料（出生資料 + 同意紀錄） ---
export function getProfile() {
  return read(KEY_PROFILE, null);
}

export function saveProfile(profile) {
  write(KEY_PROFILE, profile);
}

// --- 每日打卡 ---
export function getCheckins() {
  return read(KEY_CHECKINS, []);
}

export function addCheckin(entry) {
  const list = getCheckins();
  list.push(entry);
  write(KEY_CHECKINS, list);
  return list;
}

// --- 隱私 / 偏好開關 ---
export function getSettings() {
  return read(KEY_SETTINGS, { personalize: true, push: false, stats: false, aiDaily: true });
}

export function saveSettings(settings) {
  write(KEY_SETTINGS, settings);
}

// --- 匯出 / 刪除 ---
export function exportAllData() {
  return {
    app: '懂你紫微 DONGNI ZIWEI (MVP prototype)',
    exportedAt: new Date().toISOString(),
    profile: getProfile(),
    checkins: getCheckins(),
    settings: getSettings(),
  };
}

export function clearAllData() {
  localStorage.removeItem(KEY_PROFILE);
  localStorage.removeItem(KEY_CHECKINS);
  localStorage.removeItem(KEY_SETTINGS);
}

// 近 N 天的打卡（含今天，新的在前）
export function recentCheckins(days = 7, todayISO = toISODate()) {
  const end = parseISODate(todayISO);
  const start = parseISODate(todayISO);
  start.setDate(start.getDate() - (days - 1));
  return getCheckins()
    .filter((c) => {
      const d = parseISODate(c.date);
      return d >= start && d <= end;
    })
    .slice()
    .reverse();
}

// 連續打卡天數（今天或昨天有打才算延續中）
export function calcStreak(checkins) {
  if (!checkins.length) return 0;
  const days = new Set(checkins.map((c) => c.date));
  const cursor = new Date();
  if (!days.has(toISODate(cursor))) cursor.setDate(cursor.getDate() - 1); // 今天還沒打，從昨天往回算
  let streak = 0;
  for (;;) {
    if (!days.has(toISODate(cursor))) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
