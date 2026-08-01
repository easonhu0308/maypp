// AI 問事報告單元測試：Worker prompt / 正規化 + updateReport 儲存
// 執行：npm run test:ask-report

const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

const { buildAskPrompt, normalizeAskFields } = await import('../worker/index.js');
const { buildChartPayload } = await import('../src/lib/astro.js');
const { getReports, addReport, updateReport, clearAllData } = await import('../src/lib/storage.js');

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { pass += 1; console.log(`ok   ${name}`); }
  else { fail += 1; console.error(`FAIL ${name}`); }
}

// --- 1. buildAskPrompt：問題、對應宮位、打卡、大限都有進 prompt ---
const profile = { nickname: '小紫', solarDate: '1994-06-15', timeIndex: 4, gender: '男', genderRaw: '男' };
const chartPayload = buildChartPayload(profile, new Date('2026-08-01T15:00:00'));
const payload = {
  ...chartPayload,
  categoryName: '事業',
  categoryPalace: '官祿',
  question: '2026年下半年加薪機會',
  recentCheckins: [
    { date: '2026-07-31', mood: 3, emoji: '😮‍💨', tags: ['工作卡關'], text: '專案一直改方向' },
  ],
};
const [sys, usr] = buildAskPrompt(payload);
check('prompt 有 system+user 兩則', sys.role === 'system' && usr.role === 'user');
check('prompt 帶問題與領域', usr.content.includes('2026年下半年加薪機會') && usr.content.includes('事業'));
check('prompt 帶對應宮位區塊', usr.content.includes('【官祿宮】'));
check('prompt 帶命宮與身宮區塊', usr.content.includes('【命宮】') && usr.content.includes('【身宮所在】'));
check('prompt 帶打卡內容', usr.content.includes('工作卡關') && usr.content.includes('專案一直改方向'));
check('prompt 帶大限', usr.content.includes('目前大限'));
check('system 禁止只提命宮主星', sys.content.includes('嚴禁只提命宮主星'));
check('system 規定正向與 JSON 輸出', sys.content.includes('正向') && sys.content.includes('JSON'));

// 僕役 → 交友：payload 的宮位名已是顯示用字，對應宮位找得到
const socialPayload = { ...chartPayload, categoryName: '人際', categoryPalace: '交友', question: '', recentCheckins: [] };
const [, socialUsr] = buildAskPrompt(socialPayload);
check('交友宮位能找到對應區塊', socialUsr.content.includes('【交友宮】主星'));

// --- 2. normalizeAskFields：正規化與降級 ---
const good = normalizeAskFields({
  astrology: '官祿宮武曲天府，加薪要靠專業聲譽累積。',
  memory: '你最近專案卡關，但其實方向是對的。',
  actions: ['列出本季具體貢獻', '約主管一對一', '先自查薪資區間', '多餘的第四則'],
});
check('normalize 保留三欄位', good.astrology.includes('武曲') && good.memory.includes('卡關'));
check('normalize actions 截斷到 3 則', good.actions.length === 3);
check('normalize 缺 astrology → null', normalizeAskFields({ actions: ['x'] }) === null);
check('normalize actions 全空 → null', normalizeAskFields({ astrology: 'x', actions: [] }) === null);
check('normalize actions 非陣列 → null', normalizeAskFields({ astrology: 'x', actions: 'y' }) === null);
check('normalize 非物件 → null', normalizeAskFields('nope') === null);
check('normalize memory 可為空字串', normalizeAskFields({ astrology: 'x', actions: ['a'] }).memory === '');

// --- 3. updateReport：合併更新並持久化 ---
clearAllData();
addReport({ id: 'r_test1', createdAt: '2026-08-01T07:00:00.000Z', category: 'career', question: '加薪？', astrology: '本地版', memory: '本地', actions: ['a', 'b', 'c'] });
const updated = updateReport('r_test1', { astrology: 'LLM 深度版', source: 'llm' });
check('updateReport 回傳合併結果', updated.astrology === 'LLM 深度版' && updated.source === 'llm');
check('updateReport 保留原欄位與 id', updated.id === 'r_test1' && updated.question === '加薪？' && updated.memory === '本地');
check('updateReport 有寫入儲存', getReports()[0].astrology === 'LLM 深度版');
check('updateReport 找不到 id → null', updateReport('r_nope', { astrology: 'x' }) === null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
