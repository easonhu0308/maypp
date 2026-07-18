// 本命 + 2026 丙午流年排盤：1989-03-08 14:27（未時）男
import { astro } from 'iztro';

const a = astro.bySolar('1989-3-8', 7, '男', true, 'zh-TW');

console.log('=== 基本資料 ===');
console.log('國曆:', a.solarDate, '| 農曆:', a.lunarDate);
console.log('生肖:', a.zodiac, '| 星座:', a.sign);
console.log('五行局:', a.fiveElementsClass, '| 命主:', a.soul, '| 身主:', a.body);
console.log('命宮地支:', a.earthlyBranchOfSoulPalace, '| 身宮地支:', a.earthlyBranchOfBodyPalace);

console.log('\n=== 本命十二宮 ===');
a.palaces.forEach((p, i) => {
  const major = p.majorStars.map((s) => s.name + (s.mutagen ? `(${s.mutagen})` : '') + (s.brightness ? `[${s.brightness}]` : '')).join(' ');
  const minor = p.minorStars.map((s) => s.name + (s.mutagen ? `(${s.mutagen})` : '')).join(' ');
  console.log(`${i} ${p.earthlyBranch} ${p.heavenlyStem}${p.earthlyBranch} | ${p.name}${p.isBodyPalace ? '(身)' : ''} | 主星: ${major || '—'} | 輔星: ${minor || '—'} | 大限: ${p.decadalRange ? p.decadalRange.join('-') : '?'}`);
});

const h = a.horoscope(new Date('2026-07-16T12:00:00'));
console.log('\n=== 大限（2026 所處十年） ===');
console.log(JSON.stringify(h.decadal, null, 2));
console.log('\n=== 2026 流年 ===');
console.log(JSON.stringify(h.yearly, null, 2));
