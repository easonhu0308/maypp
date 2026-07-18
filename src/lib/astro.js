// iztro 排盤封裝：由 profile 算出本命盤，並提供命盤頁需要的衍生資料。
import { astro } from 'iztro';

// 命盤 4×4 格的地支擺放順序（'C' 為中央 2×2 資訊格）
export const CHART_ORDER = ['巳', '午', '未', '申', '辰', 'C', '酉', '卯', '戌', '寅', '丑', '子', '亥'];

// iztro 宮位名 → mockup 用字
const PALACE_NAME_MAP = { 僕役: '交友' };

const STEMS = '甲乙丙丁戊己庚辛壬癸';
const YANG_STEMS = '甲丙戊庚壬';

const cache = new Map();

export function buildAstrolabe(profile) {
  const key = `${profile.solarDate}|${profile.timeIndex}|${profile.gender}`;
  if (!cache.has(key)) {
    cache.set(key, astro.bySolar(profile.solarDate, Number(profile.timeIndex), profile.gender, true, 'zh-TW'));
  }
  return cache.get(key);
}

export function displayPalaceName(name) {
  return PALACE_NAME_MAP[name] || name;
}

// 命宮宮位物件
export function getMingPalace(astrolabe) {
  return astrolabe.palaces.find((p) => p.name === '命宮');
}

// 命宮主星名陣列（可能為空，即「命宮無主星」）
export function getMingStarNames(astrolabe) {
  const ming = getMingPalace(astrolabe);
  return ming ? ming.majorStars.map((s) => s.name) : [];
}

// 宮位兩行星曜：主星（大字）與輔/雜曜＋四化（小字）
export function palaceStarLines(palace) {
  const major = palace.majorStars.map((s) => s.name);
  const mutagens = [...palace.majorStars, ...palace.minorStars, ...palace.adjectiveStars]
    .filter((s) => s.mutagen)
    .map((s) => `化${s.mutagen}`);
  const minor = [...mutagens, ...palace.minorStars.map((s) => s.name), ...palace.adjectiveStars.map((s) => s.name)];
  return { major, minor };
}

// 年天干 → 陰 / 陽（chineseDate 字串格式：「甲戌 庚午 乙亥 庚辰」= 年月日時）
export function getYinYang(astrolabe) {
  const cd = String(astrolabe.chineseDate || '');
  const stem = [...cd].find((ch) => STEMS.includes(ch));
  if (!stem) return '';
  return YANG_STEMS.includes(stem) ? '陽' : '陰';
}

// 陰曆日期去掉年份：「一九九四年五月初十」→「五月初十」
export function lunarDateShort(astrolabe) {
  return String(astrolabe.lunarDate || '').replace(/^.+?年/, '');
}
