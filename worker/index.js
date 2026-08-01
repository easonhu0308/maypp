// ============================================================
// 懂你紫微 Worker：靜態資產（SPA）+ /api/daily LLM 日報代理
// - API key 只存在 Cloudflare secret（MOONSHOT_API_KEY），前端永遠看不到
// - 未設 key / 上游失敗時回錯誤碼，前端會靜默降級為本地模板日報
// - buildPrompt / extractJson / normalizeLlmFields 為純函式，scripts/test-llm-daily.mjs 直接測
// ============================================================

const DEFAULT_BASE = 'https://api.moonshot.ai/v1';
const DEFAULT_MODEL = 'kimi-k2.5';
const UPSTREAM_TIMEOUT_MS = 60000;
// 深度命盤解讀 prompt 大（十二宮全文＋2500 tokens），Kimi 生成常超過 25 秒，獨立放寬到 60 秒
export const CHART_UPSTREAM_TIMEOUT_MS = 60000;
// 線上首選上游：Cloudflare Workers AI（Moonshot/Kimi 的閘道會封 serverless 出口，見 README）
const WORKERS_AI_MODEL = '@cf/qwen/qwen3-30b-a3b-fp8';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

// --- Prompt（繁中、正向心理學、嚴格 JSON 輸出） ---
export function buildPrompt(payload) {
  const {
    dateISO,
    hour = 12,
    nickname = '朋友',
    gender = '',
    mingStars = [],
    dayGanzhi = '',
    recentCheckins = [],
    userProfile = '',
  } = payload || {};

  const starText = mingStars.length ? mingStars.join('、') : '（命宮無主星，借對宮）';
  const checkinLines = recentCheckins.length
    ? recentCheckins
        .map((c) => {
          const tags = (c.tags || []).length ? `［${c.tags.join('、')}］` : '';
          const text = c.text ? `「${String(c.text).slice(0, 200)}」` : '';
          return `- ${c.date} 心情${c.mood ?? '-'}/5 ${c.emoji || ''} ${tags}${text}`.trim();
        })
        .join('\n')
    : '（近 7 日無打卡）';

  const system = [
    '你是「懂你紫微」的每日日報作者——一個紫微斗數 × 正向心理學的陪伴 App。',
    '根據讀者的命盤主星與近況，為他寫今日的日報。',
    '',
    '硬規則：',
    '- 全部文案正向框架：可以承認疲憊與卡住，但結尾一定給出路與力量；不做負面斷言、不嚇人、不宿命論。',
    '- 語氣像一個很懂他的朋友：溫暖、具體、不說教、不堆砌命理術語；最多點到一兩個星曜特質即可。',
    '- 若下方提供「長期畫像」，那是你對他的長期筆記：日報要自然體現你記得他的長期狀態，但不要直接引用畫像原文。',
    '- 使用繁體中文（台灣用語）。',
    '- 內容為自我探索與娛樂用途，不提供醫療、心理治療或投資建議。',
    '- 只輸出一個 JSON 物件，不要任何多餘文字、不要 markdown 圍欄。',
    '',
    '輸出 JSON 結構（全部必填）：',
    '{',
    '  "dayKeyword": "適合…的一天，10 字內",',
    '  "score": 60 到 95 的整數（今日能量，維持正向區間）,',
    '  "lead": "今日總覽，60 字內",',
    '  "dims": { "career": 55-98 整數, "love": 55-98 整數, "money": 55-98 整數 },',
    '  "advice": "今日行動建議，80 字內，具體可執行",',
    '  "yi": ["宜：…", "宜：…", "宜：…"]（各 8 字內）,',
    '  "encouragement": "給你的一句話，80-120 字。若下方有近況打卡，先點名回應其中最近一件（讓他覺得被記得），再給鼓勵；無打卡則扣合他的命宮主星特質給肯定。",',
    '  "lucky": { "color": "兩字色名", "number": 1-9 整數, "direction": "方位" }',
    '}',
  ].join('\n');

  const user = [
    `讀者暱稱：${nickname}${gender ? `（${gender}）` : ''}`,
    `命宮主星：${starText}`,
    `今日：${dateISO}${dayGanzhi ? `（${dayGanzhi}日）` : ''}，現在時段：${hour} 點`,
    userProfile ? `他的長期畫像：${userProfile}` : '',
    '近 7 日打卡（新→舊）：',
    checkinLines,
    '',
    '請產出今日日報 JSON。',
  ].join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

// --- 從模型輸出中取出 JSON（容忍 ```json 圍欄與前後廢話） ---
export function extractJson(content) {
  if (!content || typeof content !== 'string') return null;
  let s = content.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch {
    return null;
  }
}

// --- 深度命盤解讀 Prompt（完整十二宮＋大限，嚴格 JSON 輸出） ---
export function buildChartPrompt(payload) {
  const {
    nickname = '朋友',
    gender = '',
    fiveElementsClass = '',
    soul = '',
    body = '',
    mingBranch = '',
    bodyBranch = '',
    palaces = [],
    decadal = null,
  } = payload || {};

  const palaceLines = palaces
    .map((p) => {
      const major = (p.major || []).join('、') || '（無主星）';
      const minor = (p.minor || []).join('、');
      const mut = (p.mutagens || []).join('、');
      const parts = [`【${p.name}（${p.branch}）】主星：${major}`];
      if (minor) parts.push(`輔雜曜：${minor}`);
      if (mut) parts.push(`四化：${mut}`);
      if (p.isBody) parts.push('（身宮所在）');
      return parts.join('，');
    })
    .join('\n');

  const decadeLine = decadal
    ? `目前大限：${decadal.stem}${decadal.branch}限（虛歲 ${decadal.range[0]}–${decadal.range[1]} 歲，現約 ${decadal.nominalAge} 歲）` +
      (Array.isArray(decadal.mutagen) && decadal.mutagen.length === 4
        ? `，大限四化：${decadal.mutagen[0]}化祿、${decadal.mutagen[1]}化權、${decadal.mutagen[2]}化科、${decadal.mutagen[3]}化忌`
        : '')
    : '（大限資料未提供）';

  const system = [
    '你是「懂你紫微」的命盤解讀師——一個紫微斗數 × 正向心理學的陪伴 App。',
    '根據讀者的完整本命盤，為他寫一份第一次打開 App 就會被打動的深度命盤解讀。',
    '',
    '硬規則：',
    '- 全部文案正向框架：可以承認困境與弱點，但結尾一定給出路與力量；不做負面斷言、不嚇人、不宿命論。',
    '- 語氣像一個很懂他的朋友：溫暖、具體、不說教；命理術語要轉譯成白話，讓完全不懂紫微的人也讀得懂。',
    '- 每段都要「有依據」：點到具體宮位或星曜，但用白話解釋它的意義。',
    '- 使用繁體中文（台灣用語）。',
    '- 內容為自我探索與娛樂用途，不提供醫療、心理治療或投資建議。',
    '- 只輸出一個 JSON 物件，不要任何多餘文字、不要 markdown 圍欄。',
    '',
    '輸出 JSON 結構（全部必填）：',
    '{',
    '  "summary": "總論，120-180字。格局定位＋這個人的核心特質，像朋友第一次見面就說中要害的感覺",',
    '  "dims": {',
    '    "personality": "性格本質，80-120字。命宮＋身宮＋命主身主綜合",',
    '    "career": "事業方向，80-120字。官祿宮為主，命宮星曜特質為輔",',
    '    "love": "感情模式，80-120字。夫妻宮為主，描述他在關係裡的樣子與適合的相處方式",',
    '    "money": "財運模式，80-120字。財帛宮為主，描述他與金錢的關係與累積方式",',
    '    "social": "人際風格，80-120字。交友（僕役）宮＋遷移宮為主"',
    '  },',
    '  "decade": "這十年的主題，80-120字。依目前大限干支與大限四化，給這個階段的提醒與方向"',
    '}',
  ].join('\n');

  const user = [
    `讀者暱稱：${nickname}${gender ? `（${gender}）` : ''}`,
    `五行局：${fiveElementsClass}｜命主：${soul}｜身主：${body}`,
    `命宮在${mingBranch}，身宮在${bodyBranch}`,
    '',
    '十二宮星曜：',
    palaceLines,
    '',
    decadeLine,
    '',
    '請產出深度命盤解讀 JSON。',
  ].join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

// --- 問事報告 Prompt（完整命盤＋問題＋對應宮位＋近期打卡，嚴格 JSON 輸出） ---
export function buildAskPrompt(payload) {
  const {
    nickname = '朋友',
    categoryName = '問事',
    categoryPalace = '命宮',
    question = '',
    palaces = [],
    decadal = null,
    scopeInfo = null,
    recentCheckins = [],
    userProfile = '',
  } = payload || {};

  const palaceLine = (p) => {
    if (!p) return '（無資料）';
    const major = (p.major || []).join('、') || '（無主星）';
    const minor = (p.minor || []).join('、');
    const mut = (p.mutagens || []).join('、');
    let s = `主星：${major}`;
    if (minor) s += `，輔雜曜：${minor}`;
    if (mut) s += `，四化：${mut}`;
    return s;
  };
  const focusPalace = palaces.find((p) => p.name === categoryPalace) || palaces.find((p) => p.name === '命宮');

  const checkinLines = recentCheckins.length
    ? recentCheckins
        .map((c) => `- ${c.date} 心情${c.mood ?? '-'}/5 ${c.emoji || ''}${(c.tags || []).length ? `［${c.tags.join('、')}］` : ''}${c.text ? `「${String(c.text).slice(0, 200)}」` : ''}`)
        .join('\n')
    : '（近 7 日無打卡）';

  const decadeLine = decadal
    ? `目前大限：${decadal.stem}${decadal.branch}限（虛歲 ${decadal.range[0]}–${decadal.range[1]} 歲）`
    : '（大限資料未提供）';

  const scopeLine = (label, sc) => {
    if (!sc) return '';
    const mut = Array.isArray(sc.mutagen) && sc.mutagen.length === 4
      ? `，四化：${sc.mutagen[0]}化祿、${sc.mutagen[1]}化權、${sc.mutagen[2]}化科、${sc.mutagen[3]}化忌`
      : '';
    return `${label}：${sc.stem}${sc.branch}${mut}，${label}命宮落在本命「${sc.soulNatalPalace}」`;
  };

  const system = [
    '你是「懂你紫微」的問事解讀師——一個紫微斗數 × 正向心理學的陪伴 App。',
    '讀者帶著一個具體問題來，你要結合他的本命盤（特別是與問題對應的宮位）、目前大限與近期狀態，給出一份「有推理過程」的建議。',
    '',
    '硬規則：',
    '- 全部文案正向框架：可以承認困境，但結尾一定給出路；不做負面斷言、不嚇人、不宿命論。',
    '- 命理觀點必須「有依據」：點到對應宮位的具體星曜與四化，用白話解釋它跟這個問題的關係；嚴禁只提命宮主星就下結論。',
    '- 建議必須具體可執行，避免「順其自然」「保持正向」這種空話。',
    '- 語氣像很懂他的朋友：溫暖、直接、不說教。',
    '- 若下方提供「長期畫像」，那是你對他的長期筆記：解讀要自然體現你記得他的長期狀態，但不要直接引用畫像原文。',
    '- 使用繁體中文（台灣用語）。',
    '- 內容為自我探索與娛樂用途，不提供醫療、心理治療或投資建議。',
    '- 只輸出一個 JSON 物件，不要任何多餘文字、不要 markdown 圍欄。',
    '',
    '輸出 JSON 結構（全部必填）：',
    '{',
    '  "astrology": "命理觀點，120-180字。從對應宮位的星曜組合與四化推理這個問題的結構",',
    '  "timing": "時機判斷，60-100字。結合流年/流月命宮落宮與四化，判斷這件事近期是順勢還是蓄势，什麼時候行動較有利",',
    '  "memory": "從最近狀態來看，60-100字。若下方有打卡，點名回應最近一件相關的事；無打卡則扣合他的星曜特質寫一段理解他的話",',
    '  "actions": ["具體行動建議一，30字內", "建議二，30字內", "建議三，30字內"]',
    '}',
  ].join('\n');

  const user = [
    `讀者暱稱：${nickname}`,
    `問題領域：${categoryName}（對應宮位：${categoryPalace}）`,
    `他的問題：${question || '（未填寫，給這個領域的近期指引）'}`,
    '',
    `【${categoryPalace}宮】${palaceLine(focusPalace)}`,
    `【命宮】${palaceLine(palaces.find((p) => p.name === '命宮'))}`,
    `【身宮所在】${palaceLine(palaces.find((p) => p.isBody))}`,
    decadeLine,
    scopeLine('流年', scopeInfo && scopeInfo.yearly),
    scopeLine('流月', scopeInfo && scopeInfo.monthly),
    userProfile ? `他的長期畫像：${userProfile}` : '',
    '',
    '近 7 日打卡（新→舊）：',
    checkinLines,
    '',
    '請產出問事解讀 JSON。',
  ].join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

// --- 問事報告欄位正規化；命理觀點＋至少一則行動為必要 ---
export function normalizeAskFields(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const astrology = asText(raw.astrology, '');
  if (!astrology) return null;
  let actions = Array.isArray(raw.actions) ? raw.actions.map((a) => asText(a, '')).filter(Boolean) : [];
  actions = actions.slice(0, 3);
  if (actions.length === 0) return null;
  return {
    astrology,
    timing: asText(raw.timing, ''),
    memory: asText(raw.memory, ''),
    actions,
  };
}

// --- 問事追問 Prompt（對話式，純文字回覆） ---
export function buildAskChatPrompt(payload) {
  const {
    nickname = '朋友',
    categoryName = '問事',
    question = '',
    reportAstrology = '',
    focusPalaceBrief = '',
    history = [],
    message = '',
  } = payload || {};

  const historyLines = history.length
    ? history.map((h) => `${h.role === 'user' ? '他' : '你'}：${String(h.content).slice(0, 300)}`).join('\n')
    : '（尚無追問紀錄）';

  const system = [
    '你是「懂你紫微」的問事解讀師，正在跟讀者進行一場問事對談。',
    '他已經拿到一份問事報告，現在針對報告繼續追問。你要像朋友一樣直接回答他的問題。',
    '',
    '硬規則：',
    '- 全部文案正向框架：可以承認困境，但結尾一定給出路；不做負面斷言、不嚇人、不宿命論。',
    '- 回答要扣合他的命盤依據與已給過的報告，不要前後矛盾，也不要重複報告內容。',
    '- 每次回覆 80-150 字，口語、溫暖、具體，像 LINE 回朋友一樣。',
    '- 使用繁體中文（台灣用語）。',
    '- 內容為自我探索與娛樂用途，不提供醫療、心理治療或投資建議。',
    '- 直接輸出回覆文字，不要 JSON、不要 markdown。',
  ].join('\n');

  const user = [
    `讀者暱稱：${nickname}`,
    `問題領域：${categoryName}`,
    `他原本的問題：${question || '（未填寫）'}`,
    `【對應宮位】${focusPalaceBrief || '（無資料）'}`,
    `你給他的報告命理觀點：「${reportAstrology}」`,
    '',
    '對話紀錄（舊→新）：',
    historyLines,
    '',
    `他現在問：${message}`,
    '',
    '請直接回覆。',
  ].join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

// --- 追問回覆正規化：純文字，去圍欄，非空即可 ---
export function normalizeChatReply(content) {
  if (!content || typeof content !== 'string') return null;
  let s = content.trim();
  const fence = s.match(/```(?:\w+)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  return s || null;
}

// --- 流年/流月 Prompt（scope 干支＋命宮落宮＋四化＋30 日記憶摘要，嚴格 JSON 輸出） ---
export function buildHoroscopePrompt(payload) {
  const {
    nickname = '朋友',
    palaces = [],
    decadal = null,
    scopeInfo = {},
    memorySummary = null,
    userProfile = '',
  } = payload || {};

  const palaceBrief = (name) => {
    const p = palaces.find((x) => x.name === name);
    if (!p) return '（無資料）';
    const major = (p.major || []).join('、') || '（無主星）';
    const mut = (p.mutagens || []).join('、');
    return `主星：${major}${mut ? `，四化：${mut}` : ''}`;
  };

  const scopeLine = (label, sc) => {
    if (!sc) return '';
    const mut = Array.isArray(sc.mutagen) && sc.mutagen.length === 4
      ? `，四化：${sc.mutagen[0]}化祿、${sc.mutagen[1]}化權、${sc.mutagen[2]}化科、${sc.mutagen[3]}化忌`
      : '';
    return `${label}：${sc.stem}${sc.branch}${mut}，${label}命宮落在本命「${sc.soulNatalPalace}」`;
  };

  const memoryLine = memorySummary && memorySummary.days > 0
    ? `近 30 日打卡 ${memorySummary.days} 則、平均心情 ${memorySummary.avgMood ?? '-'}/5` +
      (memorySummary.topTags && memorySummary.topTags.length
        ? `、常見標籤：${memorySummary.topTags.map(([t, n]) => `${t}×${n}`).join('、')}`
        : '')
    : '（近 30 日無打卡）';

  const system = [
    '你是「懂你紫微」的運勢解讀師——一個紫微斗數 × 正向心理學的陪伴 App。',
    '根據讀者的本命盤與流年/流月資料，寫「今年」與「本月」的運勢解讀。',
    '',
    '硬規則：',
    '- 全部文案正向框架：可以提醒注意事項，但結尾一定給出路與力量；不做負面斷言、不嚇人、不宿命論。',
    '- 解讀必須「有依據」：扣合流年/流月命宮所落的本命宮位與四化，用白話解釋意義。',
    '- 語氣像很懂他的朋友：溫暖、具體、不說教。',
    '- 若下方提供「長期畫像」，那是你對他的長期筆記：解讀要自然體現你記得他的長期狀態，但不要直接引用畫像原文。',
    '- 使用繁體中文（台灣用語）。',
    '- 內容為自我探索與娛樂用途，不提供醫療、心理治療或投資建議。',
    '- 只輸出一個 JSON 物件，不要任何多餘文字、不要 markdown 圍欄。',
    '',
    '輸出 JSON 結構（yearly/monthly 至少一個必填，資料有才給）：',
    '{',
    '  "yearly": { "theme": "今年主題，12字內", "text": "今年解讀，120-180字", "focus": "今年最值得留意的一件事，40字內" },',
    '  "monthly": { "theme": "本月主題，12字內", "text": "本月解讀，80-140字", "focus": "本月最值得留意的一件事，40字內" }',
    '}',
  ].join('\n');

  const user = [
    `讀者暱稱：${nickname}`,
    `本命【命宮】${palaceBrief('命宮')}`,
    `本命【官祿】${palaceBrief('官祿')}`,
    `本命【財帛】${palaceBrief('財帛')}`,
    `本命【夫妻】${palaceBrief('夫妻')}`,
    decadal ? `目前大限：${decadal.stem}${decadal.branch}限（虛歲 ${decadal.range[0]}–${decadal.range[1]} 歲）` : '（大限資料未提供）',
    scopeLine('流年', scopeInfo.yearly),
    scopeLine('流月', scopeInfo.monthly),
    '',
    '讀者近期狀態：',
    memoryLine,
    userProfile ? `他的長期畫像：${userProfile}` : '',
    '',
    '請產出流年/流月解讀 JSON。',
  ].filter(Boolean).join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

// --- 流年/流月欄位正規化；yearly/monthly 至少一個有 theme+text ---
function normalizeScope(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const theme = asText(raw.theme, '');
  const text = asText(raw.text, '');
  if (!theme || !text) return null;
  return { theme, text, focus: asText(raw.focus, '') };
}

export function normalizeHoroscopeFields(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const yearly = normalizeScope(raw.yearly);
  const monthly = normalizeScope(raw.monthly);
  if (!yearly && !monthly) return null;
  const out = {};
  if (yearly) out.yearly = yearly;
  if (monthly) out.monthly = monthly;
  return out;
}

// --- 用戶偏好畫像 Prompt（滾動摘要：舊畫像＋新素材 → 新畫像） ---
export function buildProfilePrompt(payload) {
  const {
    nickname = '朋友',
    previousProfile = '',
    recentCheckins = [],
    recentAsks = [],
  } = payload || {};

  const checkinLines = recentCheckins.length
    ? recentCheckins
        .map((c) => `- ${c.date} 心情${c.mood ?? '-'}/5${(c.tags || []).length ? `［${c.tags.join('、')}］` : ''}${c.text ? `「${String(c.text).slice(0, 200)}」` : ''}`)
        .join('\n')
    : '（無新打卡）';
  const askLines = recentAsks.length
    ? recentAsks.map((a) => `- 【${a.categoryName}】${String(a.question || '（未填寫）').slice(0, 100)}`).join('\n')
    : '（無問事紀錄）';

  const system = [
    '你是「懂你紫微」的用戶畫像筆記員——一個紫微斗數 × 正向心理學的陪伴 App。',
    '你的工作是維護一段「長期畫像」：這是 AI 的內部筆記，幫助未來的日報與解讀越來越懂這個人。',
    '',
    '硬規則：',
    '- 把「舊畫像」與「新素材」融合成一段新的畫像，不是 append，是重新提煉。',
    '- 聚焦「穩定的特質、反覆出現的關注主題、近期的狀態走向」；捨棄一次性的瑣事與日期。',
    '- 第二人稱（「你…」），200 字內，正向框架，不評判、不貼負面標籤。',
    '- 使用繁體中文（台灣用語）。',
    '- 只輸出一個 JSON 物件，不要任何多餘文字。',
    '',
    '輸出 JSON 結構：{ "profile": "新的長期畫像" }',
  ].join('\n');

  const user = [
    `讀者暱稱：${nickname}`,
    '',
    `舊畫像：${previousProfile || '（尚無畫像，這是第一次建立）'}`,
    '',
    '新打卡（新→舊）：',
    checkinLines,
    '',
    '最近的問事：',
    askLines,
    '',
    '請產出更新後的長期畫像 JSON。',
  ].join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

// --- 畫像欄位正規化 ---
export function normalizeProfileFields(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const profile = asText(raw.profile, '');
  if (!profile) return null;
  return { profile: profile.slice(0, 400) };
}

const clampInt = (v, min, max, fallback) => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const asText = (v, fallback) => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s || fallback;
};

// --- 把模型輸出正規化成前端日報欄位；缺關鍵欄位回 null（前端降級） ---
export function normalizeLlmFields(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const lead = asText(raw.lead, '');
  const encouragement = asText(raw.encouragement, '');
  if (!lead || !encouragement) return null;

  const dims = raw.dims && typeof raw.dims === 'object' ? raw.dims : {};
  let yi = Array.isArray(raw.yi) ? raw.yi.map((y) => asText(y, '')).filter(Boolean) : [];
  yi = yi.slice(0, 3);
  while (yi.length < 3) yi.push('宜：對自己溫柔一點');

  const lucky = raw.lucky && typeof raw.lucky === 'object' ? raw.lucky : {};
  return {
    dayKeyword: asText(raw.dayKeyword, '適合好好過的一天'),
    score: clampInt(raw.score, 60, 95, 77),
    lead,
    dims: {
      career: clampInt(dims.career, 55, 98, 77),
      love: clampInt(dims.love, 55, 98, 77),
      money: clampInt(dims.money, 55, 98, 77),
    },
    advice: asText(raw.advice, '挑一件五分鐘能開始的小事，先做了再說。'),
    yi,
    encouragement,
    lucky: {
      color: asText(lucky.color, '月白'),
      number: clampInt(lucky.number, 1, 9, 7),
      direction: asText(lucky.direction, '東'),
    },
  };
}

// --- 深度命盤解讀欄位正規化；總論＋至少一個維度為必要 ---
export const CHART_DIM_KEYS = ['personality', 'career', 'love', 'money', 'social'];

export function normalizeChartFields(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const summary = asText(raw.summary, '');
  if (!summary) return null;
  const dims = raw.dims && typeof raw.dims === 'object' ? raw.dims : {};
  const outDims = {};
  for (const k of CHART_DIM_KEYS) outDims[k] = asText(dims[k], '');
  if (!CHART_DIM_KEYS.some((k) => outDims[k])) return null;
  return {
    summary,
    dims: outDims,
    decade: asText(raw.decade, ''),
  };
}

// --- LLM 上游呼叫（日報與命盤解讀共用）；成功回 { content }，失敗回 { error: Response } ---
// 有 AI binding（Workers AI）優先走它：沒有出口封鎖問題、免費額度內、延遲低。
// 無 binding 時走 Moonshot HTTP（本機開發 / 自架情境）。
async function callLlm(env, messages, maxTokens, timeoutMs = UPSTREAM_TIMEOUT_MS) {
  if (env.AI) {
    try {
      const out = await env.AI.run(WORKERS_AI_MODEL, { messages, max_tokens: maxTokens });
      // 回應形狀全吃：純字串 / { response: 字串 } / { response: { choices } } / OpenAI 式 { choices }
      let content = '';
      if (typeof out === 'string') content = out;
      else if (out && typeof out.response === 'string') content = out.response;
      else if (out && out.response && Array.isArray(out.response.choices)) {
        content = (out.response.choices[0] && out.response.choices[0].message && out.response.choices[0].message.content) || '';
      } else if (out && Array.isArray(out.choices)) {
        content = (out.choices[0] && out.choices[0].message && out.choices[0].message.content) || '';
      }
      if (!content) {
        const shape = out && typeof out === 'object' ? `keys:${Object.keys(out).join(',')}` : typeof out;
        return { error: json({ error: 'llm_bad_response', backend: 'workers-ai', shape }, 502) };
      }
      return { content };
    } catch (err) {
      const msg = err && err.message ? String(err.message) : String(err);
      return { error: json({ error: 'llm_upstream_unreachable', backend: 'workers-ai', detail: msg.slice(0, 200) }, 502) };
    }
  }

  if (!env.MOONSHOT_API_KEY) return { error: json({ error: 'llm_not_configured' }, 501) };

  const base = (env.MOONSHOT_BASE || DEFAULT_BASE).replace(/\/$/, '');
  const model = env.MOONSHOT_MODEL || DEFAULT_MODEL;

  let upstream;
  try {
    upstream = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.MOONSHOT_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const msg = err && err.message ? String(err.message) : String(err);
    return { error: json({ error: 'llm_upstream_unreachable', detail: msg.slice(0, 200) }, 502) };
  }

  if (!upstream.ok) {
    const upstreamBody = await upstream.text().catch(() => '');
    return { error: json({ error: 'llm_upstream_error', status: upstream.status, upstreamBody: upstreamBody.slice(0, 300) }, 502) };
  }

  let data;
  try {
    data = await upstream.json();
  } catch {
    return { error: json({ error: 'llm_bad_response' }, 502) };
  }
  const content = data && data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : '';
  return { content };
}

async function handleDaily(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  if (!payload || typeof payload !== 'object' || !payload.dateISO) {
    return json({ error: 'bad_request' }, 400);
  }

  const { content, error } = await callLlm(env, buildPrompt(payload), 1200);
  if (error) return error;
  const fields = normalizeLlmFields(extractJson(content));
  if (!fields) return json({ error: 'llm_bad_response', raw: (content || '').slice(0, 200) }, 502);

  return json(fields);
}

async function handleChartReport(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.palaces) || payload.palaces.length !== 12) {
    return json({ error: 'bad_request' }, 400);
  }

  const { content, error } = await callLlm(env, buildChartPrompt(payload), 2500, CHART_UPSTREAM_TIMEOUT_MS);
  if (error) return error;
  const fields = normalizeChartFields(extractJson(content));
  if (!fields) return json({ error: 'llm_bad_response', raw: (content || '').slice(0, 200) }, 502);

  return json(fields);
}

async function handleAskReport(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.palaces) || payload.palaces.length !== 12) {
    return json({ error: 'bad_request' }, 400);
  }

  const { content, error } = await callLlm(env, buildAskPrompt(payload), 1800, CHART_UPSTREAM_TIMEOUT_MS);
  if (error) return error;
  const fields = normalizeAskFields(extractJson(content));
  if (!fields) return json({ error: 'llm_bad_response', raw: (content || '').slice(0, 200) }, 502);

  return json(fields);
}

async function handleAskChat(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  if (!payload || typeof payload !== 'object' || typeof payload.message !== 'string' || !payload.message.trim()) {
    return json({ error: 'bad_request' }, 400);
  }
  // 對話歷史截斷：最多保留最後 20 則，避免 prompt 爆量
  if (Array.isArray(payload.history)) payload.history = payload.history.slice(-20);
  else payload.history = [];

  const { content, error } = await callLlm(env, buildAskChatPrompt(payload), 800, CHART_UPSTREAM_TIMEOUT_MS);
  if (error) return error;
  const reply = normalizeChatReply(content);
  if (!reply) return json({ error: 'llm_bad_response', raw: (content || '').slice(0, 200) }, 502);

  return json({ reply });
}

async function handleHoroscopeReport(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  if (!payload || typeof payload !== 'object' || !payload.scopeInfo ||
      (!payload.scopeInfo.yearly && !payload.scopeInfo.monthly)) {
    return json({ error: 'bad_request' }, 400);
  }

  const { content, error } = await callLlm(env, buildHoroscopePrompt(payload), 1800, CHART_UPSTREAM_TIMEOUT_MS);
  if (error) return error;
  const fields = normalizeHoroscopeFields(extractJson(content));
  if (!fields) return json({ error: 'llm_bad_response', raw: (content || '').slice(0, 200) }, 502);

  return json(fields);
}

async function handleProfileSummary(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  if (!payload || typeof payload !== 'object') {
    return json({ error: 'bad_request' }, 400);
  }

  const { content, error } = await callLlm(env, buildProfilePrompt(payload), 800, CHART_UPSTREAM_TIMEOUT_MS);
  if (error) return error;
  const fields = normalizeProfileFields(extractJson(content));
  if (!fields) return json({ error: 'llm_bad_response', raw: (content || '').slice(0, 200) }, 502);

  return json(fields);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/daily') {
      if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
      return handleDaily(request, env);
    }
    if (url.pathname === '/api/chart-report') {
      if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
      return handleChartReport(request, env);
    }
    if (url.pathname === '/api/ask-report') {
      if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
      return handleAskReport(request, env);
    }
    if (url.pathname === '/api/ask-chat') {
      if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
      return handleAskChat(request, env);
    }
    if (url.pathname === '/api/horoscope-report') {
      if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
      return handleHoroscopeReport(request, env);
    }
    if (url.pathname === '/api/profile-summary') {
      if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
      return handleProfileSummary(request, env);
    }
    if (url.pathname === '/api/health') {
      return json({
        ok: true,
        llmConfigured: Boolean(env.AI || env.MOONSHOT_API_KEY),
        llmBackend: env.AI ? 'workers-ai' : env.MOONSHOT_API_KEY ? 'moonshot-http' : 'none',
      });
    }
    return env.ASSETS.fetch(request);
  },
};
