// AI 流年/流月解讀單元測試：payload / prompt / 正規化 / 打卡摘要
// 執行：npm run test:horoscope

const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

const { buildHoroscopePrompt, normalizeHoroscopeFields } = await import('../worker/index.js');
const { buildHoroscopePayload } = await import('../src/lib/astro.js');
const { summarizeCheckins } = await import('../src/lib/daily.js');

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { pass += 1; console.log(`ok   ${name}`); }
  else { fail += 1; console.error(`FAIL ${name}`); }
}

// --- 1. buildHoroscopePayload：流年與流月資料齊全 ---
const profile = { nickname: '小紫', solarDate: '1994-06-15', timeIndex: 4, gender: '男', genderRaw: '男' };
const now = new Date('2026-08-01T16:00:00');
const payload = buildHoroscopePayload(profile, 'both', now);
check('payload 有 yearly 與 monthly', Boolean(payload.scopeInfo.yearly) && Boolean(payload.scopeInfo.monthly));
check('yearly 有干支與四化', Boolean(payload.scopeInfo.yearly.stem) && payload.scopeInfo.yearly.mutagen.length === 4);
check('monthly 有干支與四化', Boolean(payload.scopeInfo.monthly.stem) && payload.scopeInfo.monthly.mutagen.length === 4);
check('yearly 命宮落宮有值且為合法宮位', typeof payload.scopeInfo.yearly.soulNatalPalace === 'string' && payload.scopeInfo.yearly.soulNatalPalace.length > 0);
check('monthly 命宮落宮有值', typeof payload.scopeInfo.monthly.soulNatalPalace === 'string' && payload.scopeInfo.monthly.soulNatalPalace.length > 0);
check('scope=yearly 只有 yearly', !buildHoroscopePayload(profile, 'yearly', now).scopeInfo.monthly);
check('yearly 國曆標籤正確', payload.scopeInfo.yearly.label === '2026 年（丙午）');
check('monthly 國曆標籤格式正確', /^2026 年 8 月（[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]）$/.test(payload.scopeInfo.monthly.label));

// --- 2. summarizeCheckins：30 日記憶壓縮 ---
const sum = summarizeCheckins([
  { date: '2026-07-30', mood: 4, tags: ['工作卡關'] },
  { date: '2026-07-29', mood: 2, tags: ['工作卡關', '有點疲憊'] },
  { date: '2026-07-28', mood: 3, tags: ['有點疲憊'] },
]);
check('摘要天數正確', sum.days === 3);
check('摘要平均心情正確', sum.avgMood === 3);
check('摘要高頻標籤排序', sum.topTags[0][0] === '工作卡關' && sum.topTags[1][0] === '有點疲憊');
check('空打卡摘要安全', summarizeCheckins([]).days === 0 && summarizeCheckins([]).avgMood === null);

// --- 3. buildHoroscopePrompt：流年/流月/記憶都有進 prompt ---
const fullPayload = { ...payload, memorySummary: sum };
const [sys, usr] = buildHoroscopePrompt(fullPayload);
check('prompt 有 system+user 兩則', sys.role === 'system' && usr.role === 'user');
check('prompt 帶流年干支與落宮', usr.content.includes('流年：') && usr.content.includes('流年命宮落在本命'));
check('prompt 帶流年國曆標籤', usr.content.includes('2026 年（丙午）') && usr.content.includes(payload.scopeInfo.monthly.label));
check('system 要求實際時間詞', sys.content.includes('今年 X 月'));
check('prompt 帶流月干支與落宮', usr.content.includes('流月：') && usr.content.includes('流月命宮落在本命'));
check('prompt 帶本命四宮', ['命宮', '官祿', '財帛', '夫妻'].every((n) => usr.content.includes(`【${n}】`)));
check('prompt 帶記憶摘要', usr.content.includes('近 30 日打卡 3 則') && usr.content.includes('工作卡關×2'));
check('system 規定正向與 JSON 輸出', sys.content.includes('正向') && sys.content.includes('JSON'));

// --- 4. normalizeHoroscopeFields ---
const good = normalizeHoroscopeFields({
  yearly: { theme: '扎根的一年', text: '今年適合…', focus: '留意健康' },
  monthly: { theme: '慢下來', text: '本月適合…', focus: '' },
});
check('normalize 保留兩 scope', good.yearly.theme === '扎根的一年' && good.monthly.text.includes('本月'));
check('normalize 允許只有 yearly', Boolean(normalizeHoroscopeFields({ yearly: good.yearly })));
check('normalize 缺 theme → 該 scope 丟棄', !normalizeHoroscopeFields({ yearly: { text: 'x' }, monthly: good.monthly }).yearly);
check('normalize 兩 scope 全爛 → null', normalizeHoroscopeFields({ yearly: {}, monthly: null }) === null);
check('normalize 非物件 → null', normalizeHoroscopeFields('nope') === null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
