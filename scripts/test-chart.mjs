// 驗證 iztro 排盤輸出：node scripts/test-chart.mjs
import { astro } from 'iztro';

const astrolabe = astro.bySolar('1994-6-18', 4, '女', true, 'zh-TW');

console.log('solarDate :', astrolabe.solarDate);
console.log('lunarDate :', astrolabe.lunarDate);
console.log('chineseDate:', astrolabe.chineseDate);
console.log('time      :', astrolabe.time);
console.log('五行局    :', astrolabe.fiveElementsClass);
console.log('命主 / 身主:', astrolabe.soul, '/', astrolabe.body);
console.log('命宮在', astrolabe.earthlyBranchOfSoulPalace, '· 身宮在', astrolabe.earthlyBranchOfBodyPalace);
console.log('---');

let mingCount = 0;
for (const p of astrolabe.palaces) {
  if (p.name === '命宮') mingCount += 1;
  const major = p.majorStars.map((s) => s.name + (s.mutagen ? `(化${s.mutagen})` : '')).join(' ') || '—';
  console.log(`${p.earthlyBranch} ${p.name}\t${major}`);
}
console.log('---');
console.log(`palace count: ${astrolabe.palaces.length} (expect 12)`);
console.log(`命宮 count  : ${mingCount} (expect 1)`);

if (astrolabe.palaces.length !== 12 || mingCount !== 1) {
  console.error('FAIL: unexpected palace structure');
  process.exit(1);
}
console.log('OK');
