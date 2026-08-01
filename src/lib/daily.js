// ============================================================
// 本地日報模板引擎（MVP）
// 同一天、同一位使用者永遠產生同一份日報：以「暱稱＋日期＋命宮主星」
// 做種子的決定性 PRNG，從文案池中抽取組合。
//
// 【LLM 接入點】未來接上真實 LLM 日報 API 時，只要改這一個檔案：
// 把 buildDailyReport() 換成呼叫後端（傳 profile、命宮主星、近 7 日打卡），
// 回傳與下方相同的物件結構，Today 畫面完全不用動。
// ============================================================
import { toISODate } from './time.js';

// --- 決定性隨機：FNV-1a 雜湊 + mulberry32 PRNG ---
function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const int = (rng, min, max) => min + Math.floor(rng() * (max - min + 1));

function sample(rng, arr, n) {
  const pool = [...arr];
  const out = [];
  while (out.length < n && pool.length) {
    out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return out;
}

// --- 日柱干支（Julian Day Number 推算，純本地計算） ---
const STEMS = '甲乙丙丁戊己庚辛壬癸';
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';

export function dayGanzhi(date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  const jdn = d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
  return STEMS[(jdn + 9) % 10] + BRANCHES[(jdn + 1) % 12];
}

// --- 文案池（硬規則：只給行動建議與溫暖鼓勵，不做負面斷言） ---
const DAY_KEYWORDS = [
  '適合被看見的一天',
  '適合慢慢來的一天',
  '適合主動出擊的一天',
  '適合整理思緒的一天',
  '適合與人連結的一天',
  '適合把想法說出口的一天',
  '適合好好照顧自己的一天',
  '適合完成一件小事的一天',
];

const LEAD_TEXTS = [
  '整體步調順暢，貴人多在「意想不到的地方」。記得：你不需要完美，只需要出現。',
  '今天的節奏由你決定。把最重要的一件事排在精神最好的時段，其他的，允許它普通就好。',
  '能量在流動，適合把卡住的東西拿出來曬一曬。你擔心的瑕疵，在別人眼裡可能是亮點。',
  '今天適合先照顧好自己，再照顧世界。一杯熱的、一段散步，都是你應得的。',
  '靈感偏多的日子。腦中閃過的念頭值得隨手記下，其中有一個會發芽。',
  '今天的人緣比你想的好。那句想說的謝謝、想約的那杯咖啡，都適合說出口。',
  '穩穩的一天。不求驚天動地，把手邊一件事做到位，就是今天最好的成績單。',
];

const ADVICE_TEMPLATES = [
  (star) => `把「想」換成「做」的一天。${star ? `${star}的你不缺想法，` : ''}挑一件五分鐘能開始的小事，先做了再說——完成感會自己長大。`,
  (star) => `適合主動出擊的日子。那份改了又改的東西、那句想說的話，今天很適合拿出來。${star ? `${star}的細膩會替你兜底。` : '你比自己想的更有底氣。'}`,
  () => '今天的關鍵字是「收尾」。把一件拖著的小事做完，你會發現心裡騰出了一塊很舒服的空地。',
  () => '適合跟人連結的一天。主動傳個訊息給一個你想到的人——你的一句話，可能剛好是對方今天需要的光。',
  () => '把待辦清單拿出來，只圈一件「今天非做不可」的。其他的都先放下，這不是偷懶，是策略。',
  () => '今天適合輸入而不是輸出：讀幾頁書、聽一集 podcast、看一段教學。給腦袋一點新養分，靈感會自己找上門。',
  () => '如果覺得有點滿，今天的建議是「減法」：推掉一件可做可不做的事，把力氣留給真正重要的人。',
];

const YI_POOL = [
  '宜：主動匯報',
  '宜：整理文件',
  '宜：早睡半小時',
  '宜：約人喝咖啡',
  '宜：把想法寫下來',
  '宜：散步十五分鐘',
  '宜：回覆那封訊息',
  '宜：把手邊的事收尾',
  '宜：學一點新東西',
  '宜：好好吃一頓飯',
  '宜：對自己溫柔一點',
  '宜：說出那句謝謝',
];

const LUCKY_COLORS = ['月白', '黛藍', '杏黃', '松綠', '藕粉', '靛青', '楓紅', '霧灰'];
const LUCKY_DIRECTIONS = ['東', '南', '西', '北', '東南', '東北', '西南', '西北'];

// 流日宮位對照（簡化版：以日柱地支對應遷移/事業/財帛/感情等生活領域）
const DAY_BRANCH_FOCUS = {
  子: { palace: '命宮', area: '自我認識' },
  丑: { palace: '父母', area: '學習與長輩' },
  寅: { palace: '福德', area: '內在安定' },
  卯: { palace: '田宅', area: '家庭與歸屬' },
  辰: { palace: '官祿', area: '事業與行動' },
  巳: { palace: '僕役', area: '朋友與合作' },
  午: { palace: '遷移', area: '外出與變動' },
  未: { palace: '疾厄', area: '健康與身體' },
  申: { palace: '財帛', area: '財務與價值' },
  酉: { palace: '子女', area: '創作與下屬' },
  戌: { palace: '夫妻', area: '感情與關係' },
  亥: { palace: '兄弟', area: '同儕與溝通' },
};

export function buildReasoning(star, dayGanzhi, dims) {
  const branch = dayGanzhi.slice(1);
  const focus = DAY_BRANCH_FOCUS[branch] || { palace: '命宮', area: '整體狀態' };
  const highDim = Object.entries(dims).sort((a, b) => b[1] - a[1])[0];
  const dimName = { career: '事業', love: '感情', money: '財運' }[highDim[0]];
  return [
    `今日日柱為${dayGanzhi}，流日能量落在你的「${focus.palace}宮」，對應生活領域是「${focus.area}」。`,
    star ? `你的命宮主星${star}，讓你在這個領域習慣用「細膩觀察」代替衝動行動。` : '今天的星象組合適合先觀察，再行動。',
    `三維指引中「${dimName}」分數最高，表示這個領域今天最容易有進展。`,
  ].join('');
}

// 打卡標籤 → 「它記得我」的一句話（回應近 7 日打卡內容）
const TAG_MEMORIES = {
  工作卡關: {
    recall: '你前陣子說工作有點卡。',
    text: (star) => `命盤上，${star || '你'}的「卡」從來不是停滯，是在繞一條更聰明的路。今天的能量站在你這邊，往前一步，不用大，一步就好。`,
  },
  有點疲憊: {
    recall: '你最近說過有點疲憊。',
    text: () => '累了不是你的錯，是你撐太久了。今天允許自己慢下來，世界不會因為你休息一下就停止轉動——但你會因為休息，重新發亮。',
  },
  想被鼓勵: {
    recall: '你說過想被鼓勵。',
    text: () => '那就說給你聽：你比你想像中做得更好。那些你覺得「還不夠」的地方，別人眼裡其實是「已經很厲害了」。今天，請把這句話放在心上。',
  },
  被稱讚了: {
    recall: '你前幾天說被稱讚了。',
    text: () => '那份肯定是你應得的，不是運氣。把它收好，在自我懷疑的日子拿出來看一看——你看，你本來就很值得。',
  },
  感情甜蜜: {
    recall: '你最近分享過感情裡的甜。',
    text: () => '被愛著的你，整個人都在發光。把這份甜分一點給生活裡的其他角落，今天做什麼都會特別順。',
  },
  家庭瑣事: {
    recall: '你最近為家庭的事費了心。',
    text: () => '你把家人照顧得很好，但別忘了你也需要被照顧。今天留十分鐘給自己，哪怕只是安靜喝杯茶，都是你應得的。',
  },
  意外驚喜: {
    recall: '你前幾天遇到了意外的驚喜。',
    text: () => '生活正在用它自己的方式對你好。保持那天的笑容出門，今天也會有小小的美好在路上等你。',
  },
  和朋友聚餐: {
    recall: '你最近和朋友聚了聚。',
    text: () => '好的友情是最好的充電器。把聚會的那份鬆弛帶進今天，你會發現事情沒有想像中那麼緊繃。',
  },
  平靜的一天: {
    recall: '你享受過平靜的一天。',
    text: () => '平靜不是無聊，是你給自己的禮物。帶著那份安穩往前走，今天的你也會很從容。',
  },
};

const GENERIC_ENCOURAGEMENTS = [
  (star) => `${star ? `${star}入命的你，` : ''}天生就懂得在變化裡找出路。今天不用急著證明什麼，穩穩地做好自己，就是最有力量的姿態。`,
  (star) => `命盤不決定你的路，它只是提醒你：${star ? `${star}的你，` : ''}本來就有把日子過好的天賦。今天，從一件讓自己開心的小事開始。`,
  () => '你走过的每一步都算數，包括那些看起來繞遠路的。今天繼續往前走，風景會慢慢對你展開。',
  () => '不必今天就想清楚所有事。先把今天過好，答案通常會在路上自己出現。',
];

function timeGreeting(hour) {
  if (hour < 5) return '夜深了';
  if (hour < 11) return '早安';
  if (hour < 14) return '午安';
  if (hour < 18) return '下午好';
  return '晚安';
}

/**
 * 產生今日日報。
 * @param {object} profile 使用者資料（nickname、gender…）
 * @param {string[]} mingStars 命宮主星名陣列
 * @param {Array} recent 近 7 日打卡（新的在前）
 * @param {Date} now 當下時間（預設現在；同一天結果恆定）
 */
export function buildDailyReport(profile, mingStars, recent = [], now = new Date()) {
  const iso = toISODate(now);
  const mingKey = (mingStars || []).join('·') || '無主星';
  const rng = mulberry32(hashSeed(`${profile.nickname}|${iso}|${mingKey}`));
  const star = (mingStars || [])[0] || '';

  // 近 7 日平均心情影響能量分（仍維持 60–95 的正向區間）
  const moods = recent.map((c) => c.mood).filter(Boolean);
  const avgMood = moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : 3;
  const moodBias = Math.round((avgMood - 3) * 3); // -6 ~ +6
  const score = Math.min(95, Math.max(60, int(rng, 60, 95) + moodBias));

  const dims = {
    career: int(rng, 55, 98),
    love: int(rng, 55, 98),
    money: int(rng, 55, 98),
  };

  // 找最近一則有對應文案的打卡標籤（新的優先）
  let memory = null;
  outer: for (const checkin of recent) {
    for (const tag of checkin.tags || []) {
      if (TAG_MEMORIES[tag]) {
        memory = TAG_MEMORIES[tag];
        break outer;
      }
    }
  }
  const encouragement = memory
    ? `${memory.recall}${memory.text(star)}`
    : pick(rng, GENERIC_ENCOURAGEMENTS)(star);

  return {
    dateISO: iso,
    greeting: timeGreeting(now.getHours()),
    dayGanzhi: dayGanzhi(now),
    dayKeyword: pick(rng, DAY_KEYWORDS),
    score,
    lead: pick(rng, LEAD_TEXTS),
    reasoning: buildReasoning(star, dayGanzhi(now), dims),
    focusPalace: DAY_BRANCH_FOCUS[dayGanzhi(now).slice(1)]?.palace || '命宮',
    dims,
    advice: pick(rng, ADVICE_TEMPLATES)(star),
    yi: sample(rng, YI_POOL, 3),
    encouragement,
    lucky: {
      color: pick(rng, LUCKY_COLORS),
      number: int(rng, 1, 9),
      direction: pick(rng, LUCKY_DIRECTIONS),
    },
  };
}

// --- 問事報告本地模板 ---
export const ASK_CATEGORIES = {
  career: { name: '事業', palace: '官祿', tone: '主動出擊前先釐清方向', icon: '💼', desc: '工作方向、轉職、提案時機' },
  love: { name: '感情', palace: '夫妻', tone: '先理解自己再理解對方', icon: '❤️', desc: '關係理解、相處節奏' },
  money: { name: '財運', palace: '財帛', tone: '穩中求進，慢一點沒關係', icon: '💰', desc: '投資、消費、談錢時機' },
  health: { name: '健康', palace: '疾厄', tone: '身體是最誠實的命盤訊號', icon: '🏃', desc: '作息、身體訊號、調養' },
  social: { name: '人際', palace: '僕役', tone: '人緣藏在細節裡', icon: '👥', desc: '朋友、合作、溝通' },
  yearly: { name: '年度運勢', palace: '命宮', tone: '大方向對了，小波折不會翻船', icon: '📅', desc: '大方向與年度重點' },
};

const ASK_ADVICE = [
  '把問題具體寫下來，比反覆想十次更有用。',
  '今天適合先跟信任的人說說看，旁觀者有時比當局者清楚。',
  '給自己一個「試試看也不虧」的小行動，先打破停滯。',
  '如果感覺亂，先把睡眠和飲食拉回正軌，其他的會跟著清楚。',
  '不需要現在就做決定，但可以先收集一個新資訊。',
];

export function buildAskReport({ category, question, profile, mingStars, recent }) {
  const cat = ASK_CATEGORIES[category] || ASK_CATEGORIES.yearly;
  const seed = hashSeed(`${profile.nickname}|${category}|${question || ''}|${(mingStars || []).join('·')}`);
  const rng = mulberry32(seed);
  const star = (mingStars || [])[0] || '';

  const tagSummary = [];
  outer: for (const checkin of recent || []) {
    for (const tag of checkin.tags || []) {
      if (TAG_MEMORIES[tag]) {
        tagSummary.push(TAG_MEMORIES[tag].recall.replace('。', ''));
        break outer;
      }
    }
  }

  return {
    id: `r_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    createdAt: new Date().toISOString(),
    category,
    categoryName: cat.name,
    question: question || `${cat.name}方向該怎麼走？`,
    astrology: [
      `你的命宮主星${star ? `為${star}` : '組合特殊'}，面對${cat.name}議題時，容易想很多再行動。`,
      `${cat.palace}宮代表你的${cat.name}能量，今天的建議方向是：${cat.tone}。`,
      star ? `${star}的細膩會幫你避開冒進，但偶爾也要允許自己「先做再調整」。` : '星象支持你循序漸進，不必一次到位。',
    ].join(''),
    memory: tagSummary.length ? `從你最近的打卡來看：${tagSummary[0]}。` : '最近你還沒有相關打卡，記錄心情會讓建議更貼近你。',
    actions: sample(rng, ASK_ADVICE, 3),
  };
}
