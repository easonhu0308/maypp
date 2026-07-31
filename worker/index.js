// ============================================================
// 懂你紫微 Worker：靜態資產（SPA）+ /api/daily LLM 日報代理
// - API key 只存在 Cloudflare secret（MOONSHOT_API_KEY），前端永遠看不到
// - 未設 key / 上游失敗時回錯誤碼，前端會靜默降級為本地模板日報
// - buildPrompt / extractJson / normalizeLlmFields 為純函式，scripts/test-llm-daily.mjs 直接測
// ============================================================

const DEFAULT_BASE = 'https://api.moonshot.ai/v1';
const DEFAULT_MODEL = 'kimi-k2.5';
const UPSTREAM_TIMEOUT_MS = 25000;

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

async function handleDaily(request, env) {
  if (!env.MOONSHOT_API_KEY) return json({ error: 'llm_not_configured' }, 501);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  if (!payload || typeof payload !== 'object' || !payload.dateISO) {
    return json({ error: 'bad_request' }, 400);
  }

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
        messages: buildPrompt(payload),
        max_tokens: 1200,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    return json({ error: 'llm_upstream_unreachable' }, 502);
  }

  if (!upstream.ok) {
    const upstreamBody = await upstream.text().catch(() => '');
    return json({ error: 'llm_upstream_error', status: upstream.status, upstreamBody: upstreamBody.slice(0, 300) }, 502);
  }

  let data;
  try {
    data = await upstream.json();
  } catch {
    return json({ error: 'llm_bad_response' }, 502);
  }
  const content = data && data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : '';
  const fields = normalizeLlmFields(extractJson(content));
  if (!fields) return json({ error: 'llm_bad_response' }, 502);

  return json(fields);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/daily') {
      if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
      return handleDaily(request, env);
    }
    if (url.pathname === '/api/health') {
      return json({ ok: true, llmConfigured: Boolean(env.MOONSHOT_API_KEY) });
    }
    return env.ASSETS.fetch(request);
  },
};
