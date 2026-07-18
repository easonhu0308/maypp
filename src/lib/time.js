// 時辰與日期工具。timeIndex 對應 iztro：子=0、丑=1 … 亥=11（子時涵蓋 23-01）。
export const TIME_SLOTS = [
  { index: 0, name: '子', range: '23-01' },
  { index: 1, name: '丑', range: '01-03' },
  { index: 2, name: '寅', range: '03-05' },
  { index: 3, name: '卯', range: '05-07' },
  { index: 4, name: '辰', range: '07-09' },
  { index: 5, name: '巳', range: '09-11' },
  { index: 6, name: '午', range: '11-13' },
  { index: 7, name: '未', range: '13-15' },
  { index: 8, name: '申', range: '15-17' },
  { index: 9, name: '酉', range: '17-19' },
  { index: 10, name: '戌', range: '19-21' },
  { index: 11, name: '亥', range: '21-23' },
];

export const WEEKDAYS = '日一二三四五六';

export function timeSlotName(index) {
  const slot = TIME_SLOTS.find((s) => s.index === Number(index));
  return slot ? slot.name : '';
}

// 本地時區的 YYYY-MM-DD（給 iztro / 打卡紀錄用）
export function toISODate(d = new Date()) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// ISO date → Date（本地時區，避免 new Date('YYYY-MM-DD') 的 UTC 陷阱）
export function parseISODate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// 「7月16日 星期四」
export function formatDateLabel(d = new Date()) {
  return `${d.getMonth() + 1}月${d.getDate()}日 星期${WEEKDAYS[d.getDay()]}`;
}

// 「7/16（四）」
export function formatShortLabel(iso) {
  const d = typeof iso === 'string' ? parseISODate(iso) : iso;
  return `${d.getMonth() + 1}/${d.getDate()}（${WEEKDAYS[d.getDay()]}）`;
}

// 1994-06-18 → 1994.06.18
export function formatDots(iso) {
  return iso.replace(/-/g, '.');
}

export function daysBetween(isoA, isoB) {
  return Math.round((parseISODate(isoB) - parseISODate(isoA)) / 86400000);
}
