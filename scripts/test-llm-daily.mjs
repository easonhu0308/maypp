// AI 雲端日報單元測試：Worker 的 prompt / JSON 萃取 / 正規化 + 本地降級恆定性
// 執行：npm run test:llm
import { buildPrompt, extractJson, normalizeLlmFields } from '../worker/index.js';
import { buildDailyReport } from '../src/lib/daily.js';

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { pass += 1; console.log(`ok   ${name}`); }
  else { fail += 1; console.error(`FAIL ${name}`); }
}

// --- 1. buildPrompt：context 有進去、輸出 schema 有規定 ---
const [sys, usr] = buildPrompt({
  dateISO: '2026-07-28',
  hour: 9,
  nickname: '小艾',
  gender: '女',
  mingStars: ['紫微', '天府'],
  dayGanzhi: '壬寅',
  recentCheckins: [
    { date: '2026-07-27', mood: 2, emoji: '😮‍💨', tags: ['工作卡關'], text: '專案一直改方向' },
  ],
});
check('prompt 有 system+user 兩則', sys.role === 'system' && usr.role === 'user');
check('prompt 帶暱稱與主星', usr.content.includes('小艾') && usr.content.includes('紫微、天府'));
check('prompt 帶打卡內容', usr.content.includes('工作卡關') && usr.content.includes('專案一直改方向'));
check('system 規定正向與 JSON 輸出', sys.content.includes('正向') && sys.content.includes('JSON'));

// --- 2. extractJson：容忍圍欄與廢話 ---
check('extractJson 解析純 JSON', extractJson('{"a":1}')?.a === 1);
check('extractJson 容忍 ```json 圍欄', extractJson('好\n```json\n{"a":2}\n```')?.a === 2);
check('extractJson 容忍前後廢話', extractJson('這是日報：{"a":3} 請查收')?.a === 3);
check('extractJson 拒絕非 JSON', extractJson('完全沒有物件') === null);

// --- 3. normalizeLlmFields：正規化與降級 ---
const good = normalizeLlmFields({
  dayKeyword: '適合收尾的一天',
  score: '87',               // 字串要轉 int
  lead: '今天適合把拖著的事做完。',
  dims: { career: 130, love: 40, money: 88 },  // 超界要 clamp
  advice: '先收尾再開始。',
  yi: ['宜：整理桌面'],
  encouragement: '你比你想的更有耐心。',
  lucky: { color: '黛藍', number: 42, direction: '北' },
});
check('normalize 保留文字欄位', good.lead.includes('拖著') && good.encouragement.includes('耐心'));
check('normalize score 字串→int', good.score === 87);
check('normalize dims clamp 55-98', good.dims.career === 98 && good.dims.love === 55);
check('normalize yi 補滿 3 則', good.yi.length === 3);
check('normalize lucky.number clamp 1-9', good.lucky.number === 9);
check('normalize 缺 lead → null', normalizeLlmFields({ encouragement: 'x' }) === null);
check('normalize 缺 encouragement → null', normalizeLlmFields({ lead: 'x' }) === null);
check('normalize 非物件 → null', normalizeLlmFields('nope') === null);

// --- 4. 本地降級引擎：同一天同人，種子欄位恆定（greeting 依時段變化屬正常） ---
const profile = { nickname: '小艾', gender: '女' };
const r1 = buildDailyReport(profile, ['紫微'], [], new Date('2026-07-28T09:00:00'));
const r2 = buildDailyReport(profile, ['紫微'], [], new Date('2026-07-28T22:00:00'));
check('本地日報同日種子欄位恆定', r1.score === r2.score && r1.lead === r2.lead && r1.encouragement === r2.encouragement);
check('本地日報問候語依時段', r1.greeting !== r2.greeting);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
