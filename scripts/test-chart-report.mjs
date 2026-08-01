// AI 深度命盤解讀單元測試：Worker prompt / 正規化 + 前端 payload 完整性
// 執行：npm run test:chart-report
import { buildChartPrompt, normalizeChartFields, CHART_UPSTREAM_TIMEOUT_MS } from '../worker/index.js';
import { buildChartPayload } from '../src/lib/astro.js';
import { FETCH_TIMEOUT_MS as CHART_FETCH_TIMEOUT_MS } from '../src/lib/llmChart.js';

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { pass += 1; console.log(`ok   ${name}`); }
  else { fail += 1; console.error(`FAIL ${name}`); }
}

// --- 1. buildChartPayload：十二宮齊全、大限有算出來 ---
const profile = { nickname: '小艾', solarDate: '1994-06-15', timeIndex: 4, gender: '男', genderRaw: '男' };
const payload = buildChartPayload(profile, new Date('2026-08-01T12:00:00'));
check('payload 十二宮齊全', payload.palaces.length === 12);
check('payload 宮位含主星陣列與四化陣列', payload.palaces.every((p) => Array.isArray(p.major) && Array.isArray(p.mutagens)));
check('payload 恰一個身宮', payload.palaces.filter((p) => p.isBody).length === 1);
check('payload 命宮有主星或為空陣列', Array.isArray(payload.palaces.find((p) => p.name === '命宮').major));
check('payload 大限有干支與歲數區間',
  payload.decadal && payload.decadal.stem && payload.decadal.branch &&
  payload.decadal.range[0] <= payload.decadal.nominalAge && payload.decadal.nominalAge <= payload.decadal.range[1]);
check('payload 大限四化為 4 星', Array.isArray(payload.decadal.mutagen) && payload.decadal.mutagen.length === 4);
check('payload 僕役顯示為交友', payload.palaces.some((p) => p.name === '交友') && !payload.palaces.some((p) => p.name === '僕役'));

// --- 2. buildChartPrompt：完整命盤與大限有進 prompt ---
const [sys, usr] = buildChartPrompt(payload);
check('prompt 有 system+user 兩則', sys.role === 'system' && usr.role === 'user');
check('prompt 帶暱稱與五行局', usr.content.includes('小艾') && usr.content.includes(payload.fiveElementsClass));
check('prompt 帶十二宮', usr.content.includes('【命宮') && usr.content.includes('【夫妻') && usr.content.includes('【財帛'));
check('prompt 帶大限干支與四化', usr.content.includes('目前大限') && usr.content.includes('化祿') && usr.content.includes('化忌'));
check('system 規定正向與 JSON 輸出', sys.content.includes('正向') && sys.content.includes('JSON'));
check('system 指定五個維度', ['personality', 'career', 'love', 'money', 'social'].every((k) => sys.content.includes(k)));

// --- 3. normalizeChartFields：正規化與降級 ---
const good = normalizeChartFields({
  summary: '你是天生讓人放心的人。',
  dims: { personality: '穩重', career: '適合扛責任', love: '', money: '慢慢累積', social: '分寸感好' },
  decade: '這十年是打底期。',
});
check('normalize 保留 summary 與 dims', good.summary.includes('放心') && good.dims.career.includes('責任'));
check('normalize 保留 decade', good.decade.includes('打底'));
check('normalize 容許部分維度為空字串', good.dims.love === '');
check('normalize 缺 summary → null', normalizeChartFields({ dims: { career: 'x' } }) === null);
check('normalize dims 全空 → null', normalizeChartFields({ summary: 'x', dims: {} }) === null);
check('normalize 非物件 → null', normalizeChartFields('nope') === null);

// --- 4. 逾時設定：大 prompt 需要更長的上游等待，且前端必須比 worker 更久 ---
check('chart 上游逾時 >= 60s', CHART_UPSTREAM_TIMEOUT_MS >= 60000);
check('前端 fetch 逾時 > 上游逾時', CHART_FETCH_TIMEOUT_MS > CHART_UPSTREAM_TIMEOUT_MS);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
