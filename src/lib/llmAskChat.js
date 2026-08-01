// ============================================================
// AI 問事追問協調層：向 Worker /api/ask-chat 送對話。
// - stateless：前端送對話歷史，worker 不存狀態
// - 對話紀錄由呼叫端（ReportDetail）存進報告物件
// - 任何失敗 → 回 null，呼叫端提示稍後再試
// ============================================================
import { getSettings } from './storage.js';

export const FETCH_TIMEOUT_MS = 70000;
// 每份報告的追問則數上限（客戶端計數；真正的配額要等登入機制）
export const MAX_CHAT_TURNS = 10;

/**
 * 送一則追問，取得回覆文字。回傳 null 代表「不可用」。
 */
export async function fetchAskChatReply({ nickname, category, question, reportAstrology, focusPalaceBrief, history, message }) {
  const settings = getSettings();
  if (settings.aiDaily === false) return null;

  const payload = {
    nickname,
    categoryName: category.name,
    question: (question || '').slice(0, 200),
    reportAstrology: (reportAstrology || '').slice(0, 400),
    focusPalaceBrief: focusPalaceBrief || '',
    history: (history || []).slice(-20).map((h) => ({
      role: h.role === 'user' ? 'user' : 'assistant',
      content: String(h.content).slice(0, 300),
    })),
    message: message.slice(0, 300),
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch('/api/ask-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data && typeof data.reply === 'string' && data.reply ? data.reply : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
