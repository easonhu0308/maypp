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

// 流日資訊：今日干支、流日命宮落本命哪一宮、流日四化（送日報 prompt 解釋「為什麼今天有這種感覺」）
export function buildDailyInfo(profile, now = new Date()) {
  const astrolabe = buildAstrolabe(profile);
  const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const daily = astrolabe.horoscope(iso).daily;
  return {
    stem: daily.heavenlyStem,
    branch: daily.earthlyBranch,
    soulNatalPalace: displayPalaceName(astrolabe.palaces[daily.index].name),
    mutagen: daily.mutagen,
  };
}

// 流年/流月 payload：本命盤＋指定 scope 的干支、四化、命宮落宮
// scope: 'yearly' | 'monthly'；iztro palaceNames[i] 對應 palaces[i]，index 即該 scope 命宮位置
export function buildHoroscopePayload(profile, scope, now = new Date()) {
  const base = buildChartPayload(profile, now);
  const astrolabe = buildAstrolabe(profile);
  const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const h = astrolabe.horoscope(iso);
  const pick = (sc) => {
    const soulIdx = sc.palaceNames.indexOf('命宮');
    return {
      stem: sc.heavenlyStem,
      branch: sc.earthlyBranch,
      mutagen: sc.mutagen,
      soulNatalPalace: soulIdx >= 0 ? base.palaces[soulIdx].name : '',
      palaceNames: sc.palaceNames,
    };
  };
  const scopeInfo = {};
  if (scope === 'yearly' || scope === 'both') scopeInfo.yearly = pick(h.yearly);
  if (scope === 'monthly' || scope === 'both') scopeInfo.monthly = pick(h.monthly);
  return { ...base, scopeInfo };
}
// 深度命盤解讀 payload：完整十二宮星曜＋目前大限，送 Worker /api/chart-report
export function buildChartPayload(profile, now = new Date()) {
  const astrolabe = buildAstrolabe(profile);
  const palaces = astrolabe.palaces.map((p) => ({
    name: displayPalaceName(p.name),
    branch: p.earthlyBranch,
    major: p.majorStars.map((s) => s.name),
    minor: [...p.minorStars, ...p.adjectiveStars].map((s) => s.name),
    mutagens: [...p.majorStars, ...p.minorStars, ...p.adjectiveStars]
      .filter((s) => s.mutagen)
      .map((s) => `${s.name}化${s.mutagen}`),
    isBody: Boolean(p.isBodyPalace),
  }));

  // 目前大限：以虛歲找 range 涵蓋的宮位，再取 horoscope 的大限干支與四化
  const birthYear = Number(String(profile.solarDate).slice(0, 4));
  const nominalAge = now.getFullYear() - birthYear + 1;
  const decadePalace = astrolabe.palaces.find(
    (p) => p.decadal && nominalAge >= p.decadal.range[0] && nominalAge <= p.decadal.range[1]
  );
  let decadal = null;
  if (decadePalace) {
    const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const h = astrolabe.horoscope(iso);
    decadal = {
      stem: h.decadal.heavenlyStem,
      branch: h.decadal.earthlyBranch,
      range: decadePalace.decadal.range,
      nominalAge,
      mutagen: h.decadal.mutagen,
    };
  }

  return {
    nickname: profile.nickname,
    gender: profile.genderRaw || profile.gender || '',
    fiveElementsClass: astrolabe.fiveElementsClass,
    soul: astrolabe.soul,
    body: astrolabe.body,
    mingBranch: astrolabe.earthlyBranchOfSoulPalace,
    bodyBranch: astrolabe.earthlyBranchOfBodyPalace,
    palaces,
    decadal,
  };
}
