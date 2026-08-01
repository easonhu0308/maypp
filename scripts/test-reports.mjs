// 問事報告與儲存單元測試
// 執行：npm run test:reports

const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

const { buildReasoning, buildAskReport, ASK_CATEGORIES } = await import('../src/lib/daily.js');
const { getReports, addReport, getReportById, clearAllData } = await import('../src/lib/storage.js');

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { pass += 1; console.log(`ok   ${name}`); }
  else { fail += 1; console.error(`FAIL ${name}`); }
}

const profile = { nickname: '小紫', solarDate: '1994-06-18', timeIndex: 4, genderRaw: '女', gender: '女' };
const mingStars = ['太陽', '巨門'];

// --- 1. buildReasoning ---
const reasoning = buildReasoning('太陽', '丙午', { career: 80, love: 65, money: 70 });
check('buildReasoning 回傳字串', typeof reasoning === 'string' && reasoning.length > 0);
check('buildReasoning 包含日柱與宮位', reasoning.includes('丙午') && reasoning.includes('宮'));
check('buildReasoning 包含最高維度', reasoning.includes('事業'));

// --- 2. buildAskReport ---
const askReport = buildAskReport({ category: 'career', question: '這週適合提案嗎？', profile, mingStars, recent: [] });
check('buildAskReport 有 id', typeof askReport.id === 'string' && askReport.id.startsWith('r_'));
check('buildAskReport 有 createdAt', typeof askReport.createdAt === 'string');
check('buildAskReport 保留 category 與 question', askReport.category === 'career' && askReport.question === '這週適合提案嗎？');
check('buildAskReport 產出命理觀點與行動', typeof askReport.astrology === 'string' && Array.isArray(askReport.actions) && askReport.actions.length === 3);
check('buildAskReport 回應打卡記憶', typeof askReport.memory === 'string');

// --- 3. 儲存與查找 ---
clearAllData();
check('初始 reports 為空', getReports().length === 0);

const r1 = buildAskReport({ category: 'love', question: '感情問題', profile, mingStars, recent: [] });
addReport(r1);
check('addReport 後能取得', getReports().length === 1 && getReports()[0].id === r1.id);
check('getReportById 能找到', getReportById(r1.id)?.id === r1.id);
check('getReportById 找不到回 null', getReportById('no-such-id') === null);

// --- 4. 上限 50 筆 ---
clearAllData();
for (let i = 0; i < 55; i += 1) {
  addReport(buildAskReport({ category: 'money', question: `q${i}`, profile, mingStars, recent: [] }));
}
check('reports 上限 50 筆', getReports().length === 50);
check('只保留最新的 50 筆', getReports()[0].question === 'q54');

// --- 5. ASK_CATEGORIES 統一常數 ---
check('ASK_CATEGORIES 包含六大類', ['career', 'love', 'money', 'health', 'social', 'yearly'].every((k) => k in ASK_CATEGORIES));
check('ASK_CATEGORIES 每類有名稱與宮位', Object.values(ASK_CATEGORIES).every((c) => c.name && c.palace));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
