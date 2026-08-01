// 擇日核心：本地規則掃描未來 N 天流日，挑出對指定事項最順的 3 天。
// 純函式、可測試；LLM 只負責把結果寫成有溫度的理由（llmAuspicious.js）。
import { buildAstrolabe, displayPalaceName } from './astro.js';

// 事項 → 主題宮位（流日四化與命宮落宮在此加分）
export const AUSPICIOUS_ACTIVITIES = {
  health: { name: '健康檢查', icon: '🩺', palaces: ['疾厄'] },
  contract: { name: '簽約合作', icon: '🤝', palaces: ['官祿', '交友'] },
  interview: { name: '面試談判', icon: '💼', palaces: ['官祿', '遷移'] },
  travel: { name: '旅行出遊', icon: '✈️', palaces: ['遷移'] },
  money: { name: '理財投資', icon: '💰', palaces: ['財帛'] },
  move: { name: '搬家入宅', icon: '🏠', palaces: ['田宅'] },
  love: { name: '告白約會', icon: '💗', palaces: ['夫妻'] },
  project: { name: '啟動新計畫', icon: '🚀', palaces: ['命宮', '官祿'] },
};

const MUTAGEN_TYPES = ['祿', '權', '科', '忌'];

function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 掃描 from 之後 days 天的流日，回傳分數最高的前 3 天。
 * 計分：命宮入主題宮 +15；祿+10／權+6／科+6 在主題宮；忌在主題宮 −12；忌在命宮 −6。
 */
export function scanAuspiciousDays(profile, activityKey, { days = 30, from = new Date(), top = 3 } = {}) {
  const activity = AUSPICIOUS_ACTIVITIES[activityKey];
  if (!activity) return [];
  const astrolabe = buildAstrolabe(profile);
  const palaces = astrolabe.palaces;

  // 星曜名 → 本命宮位（判斷流日四化落在哪一宮）
  const starPalace = {};
  for (const p of palaces) {
    for (const s of [...p.majorStars, ...p.minorStars, ...p.adjectiveStars]) {
      if (!starPalace[s.name]) starPalace[s.name] = displayPalaceName(p.name);
    }
  }

  const focus = activity.palaces;
  const results = [];
  for (let i = 1; i <= days; i++) {
    const d = new Date(from.getTime() + i * 86400000);
    const iso = toISO(d);
    const daily = astrolabe.horoscope(iso).daily;
    const soulNatal = displayPalaceName(palaces[daily.index].name);
    let score = 60;
    const hits = [];

    if (focus.includes(soulNatal)) {
      score += 15;
      hits.push(`流日命宮入${soulNatal}宮`);
    }
    daily.mutagen.forEach((star, idx) => {
      const type = MUTAGEN_TYPES[idx];
      const palace = starPalace[star];
      if (!palace) return;
      if (focus.includes(palace)) {
        if (type === '祿') { score += 10; hits.push(`${star}化祿照${palace}宮`); }
        if (type === '權') { score += 6; hits.push(`${star}化權照${palace}宮`); }
        if (type === '科') { score += 6; hits.push(`${star}化科照${palace}宮`); }
        if (type === '忌') { score -= 12; hits.push(`${star}化忌擾${palace}宮`); }
      }
      if (type === '忌' && palace === '命宮') {
        score -= 6;
        hits.push(`${star}化忌在命宮`);
      }
    });

    results.push({ date: iso, ganzhi: `${daily.heavenlyStem}${daily.earthlyBranch}`, score, soulNatal, hits });
  }

  results.sort((a, b) => b.score - a.score || (a.date < b.date ? -1 : 1));
  return results.slice(0, top);
}

// LLM 失敗時的本地理由：直接列出命理依據，照樣有內容可看
export function localDayReason(day, activity) {
  const basis = day.hits.length ? day.hits.join('，') : `流日命宮在${day.soulNatal}宮，能量平穩`;
  return `${basis}。這一天適合安排${activity.name}，順著星曜的節奏走，會比硬闖更省力。`;
}

export const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export function formatDayLabel(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return `${d.getMonth() + 1}月${d.getDate()}日 週${WEEKDAYS[d.getDay()]}`;
}
