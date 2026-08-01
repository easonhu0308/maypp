// 擇日功能單元測試：掃描邏輯 / prompt / 正規化 / 本地降級理由
// 執行：npm run test:auspicious
import { buildAuspiciousPrompt, normalizeAuspiciousFields } from '../worker/index.js';
import {
  AUSPICIOUS_ACTIVITIES,
  scanAuspiciousDays,
  localDayReason,
  formatDayLabel,
} from '../src/lib/auspicious.js';

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { pass += 1; console.log(`ok   ${name}`); }
  else { fail += 1; console.error(`FAIL ${name}`); }
}

const profile = { nickname: '小紫', solarDate: '1994-06-15', timeIndex: 4, gender: '男', genderRaw: '男' };
const from = new Date('2026-08-01T12:00:00');

// --- 1. scanAuspiciousDays：結構與恆定性 ---
const days = scanAuspiciousDays(profile, 'health', { days: 30, from });
check('回傳恰好 3 天', days.length === 3);
check('每天有必要欄位', days.every((d) => d.date && d.ganzhi && typeof d.score === 'number' && d.soulNatal && Array.isArray(d.hits)));
check('分數由高到低排序', days[0].score >= days[1].score && days[1].score >= days[2].score);
check('日期都是未來且不重複', new Set(days.map((d) => d.date)).size === 3 && days.every((d) => d.date > '2026-08-01'));
check('同一輸入結果恆定', JSON.stringify(scanAuspiciousDays(profile, 'health', { days: 30, from })) === JSON.stringify(days));
check('不同事項結果不同（至少排序或命中不同）',
  JSON.stringify(scanAuspiciousDays(profile, 'money', { days: 30, from })) !== JSON.stringify(days));
check('未知事項回空陣列', scanAuspiciousDays(profile, 'nope', { days: 30, from }).length === 0);
check('八個事項都有名稱與宮位', Object.values(AUSPICIOUS_ACTIVITIES).every((a) => a.name && Array.isArray(a.palaces) && a.palaces.length > 0));

// --- 2. localDayReason 降級 ---
const reason = localDayReason(days[0], AUSPICIOUS_ACTIVITIES.health);
check('本地理由為非空字串', typeof reason === 'string' && reason.length > 10);
check('本地理由提到事項', reason.includes('健康檢查'));
check('formatDayLabel 格式正確', /^\d+月\d+日 週[日一二三四五六]$/.test(formatDayLabel('2026-08-15')));

// --- 3. buildAuspiciousPrompt ---
const [sys, usr] = buildAuspiciousPrompt({
  nickname: '小紫',
  activityName: '健康檢查',
  days: days.map((d) => ({ date: d.date, ganzhi: d.ganzhi, hits: d.hits })),
  userProfile: '你是穩健的規劃者。',
});
check('prompt 有 system+user 兩則', sys.role === 'system' && usr.role === 'user');
check('prompt 帶事項與日期', usr.content.includes('健康檢查') && usr.content.includes(days[0].date));
check('prompt 帶命理依據與畫像', usr.content.includes('長期畫像') && (days[0].hits.length === 0 || usr.content.includes(days[0].hits[0])));
check('system 禁止大凶用語', sys.content.includes('不說「哪天大凶不能去」') || sys.content.includes('大凶'));
check('system 規定 date 必須與輸入一致', sys.content.includes('必須與輸入完全一致'));

// --- 4. normalizeAuspiciousFields ---
const good = normalizeAuspiciousFields({
  intro: '這個月適合安排身體檢查的日子不少。',
  days: [
    { date: days[0].date, title: '安心檢查日', reason: '流日命宮入疾厄宮…' },
    { date: days[1].date, title: '', reason: '化祿照疾厄…' },
    { date: '', title: '壞的', reason: '' },
  ],
  note: '順著節奏走。',
});
check('normalize 保留 intro 與 note', good.intro.includes('身體檢查') && good.note.includes('節奏'));
check('normalize 過濾壞日期', good.days.length === 2);
check('normalize 允許空 title', good.days[1].title === '');
check('normalize 缺 intro → null', normalizeAuspiciousFields({ days: [{ date: 'x', reason: 'y' }] }) === null);
check('normalize days 全爛 → null', normalizeAuspiciousFields({ intro: 'x', days: [] }) === null);
check('normalize 非物件 → null', normalizeAuspiciousFields('nope') === null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
