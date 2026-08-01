import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getProfile, getReports, getSettings, recentCheckins, updateReport } from '../lib/storage.js';
import { ASK_CATEGORIES } from '../lib/daily.js';
import { fetchLlmAskReport } from '../lib/llmAsk.js';
import { fetchAskChatReply, MAX_CHAT_TURNS } from '../lib/llmAskChat.js';
import TabBar from '../components/TabBar.jsx';

const categoryLabel = (key) => {
  const c = ASK_CATEGORIES[key];
  return c ? `${c.icon} ${c.name}` : '🔮 問事';
};

export default function ReportDetail() {
  const [searchParams] = useSearchParams();
  const reportId = searchParams.get('id');
  const reports = useMemo(() => getReports(), []);
  const report = useMemo(() => {
    return reports.find((r) => r.id === reportId) || null;
  }, [reports, reportId]);

  // 本地模板報告先秒開；背景取 LLM 深度版，回來後無縫替換並存回 localStorage
  const [llmFields, setLlmFields] = useState(null);
  const [upgrading, setUpgrading] = useState(false);
  // 追問對話：初始讀取報告內已存對話；每輪送出後存回報告
  const [chatTurns, setChatTurns] = useState(() => (report && Array.isArray(report.chat) ? report.chat : []));
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!report || report.source === 'llm') return;
    if (getSettings().aiDaily === false) return;
    let alive = true;
    setUpgrading(true);
    const category = ASK_CATEGORIES[report.category] || { name: '問事', palace: '命宮' };
    fetchLlmAskReport({
      profile: getProfile(),
      category,
      question: report.question,
      recent: recentCheckins(7),
    }).then((fields) => {
      if (!alive) return;
      if (fields) {
        updateReport(report.id, fields);
        setLlmFields(fields);
      }
      setUpgrading(false);
    });
    return () => { alive = false; };
  }, [report]);

  const aiOn = getSettings().aiDaily !== false;
  const userTurns = chatTurns.filter((t) => t.role === 'user').length;
  const canSend = Boolean(chatInput.trim()) && !sending && userTurns < MAX_CHAT_TURNS;

  const handleSend = async () => {
    if (!canSend || !report) return;
    const msg = chatInput.trim();
    const newTurns = [...chatTurns, { role: 'user', content: msg }];
    setChatTurns(newTurns);
    setChatInput('');
    setSending(true);
    const category = ASK_CATEGORIES[report.category] || { name: '問事', palace: '命宮' };
    const reply = await fetchAskChatReply({
      nickname: getProfile().nickname,
      category,
      question: report.question,
      reportAstrology: llmFields?.astrology || report.astrology,
      focusPalaceBrief: '',
      history: chatTurns,
      message: msg,
    });
    const finalTurns = [
      ...newTurns,
      { role: 'assistant', content: reply || '（剛剛連線不穩，這則沒回成功，再問我一次吧）' },
    ];
    setChatTurns(finalTurns);
    updateReport(report.id, { chat: finalTurns });
    setSending(false);
  };

  if (!report) {
    return (
      <div className="app">
        <div className="page-head">
          <div className="eyebrow">REPORT</div>
          <h1>懂我報告</h1>
        </div>
        <div className="card center" style={{ borderStyle: 'dashed' }}>
          <p className="lead">還沒有報告</p>
          <Link className="btn btn-gold mt8" to="/ask">去問一件事 ✦</Link>
        </div>
        <TabBar active="ask" />
      </div>
    );
  }

  const dateStr = new Date(report.createdAt).toLocaleDateString('zh-Hant', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="app">
      <div className="page-head">
        <div className="eyebrow">REPORT</div>
        <h1>{categoryLabel(report.category)}報告</h1>
        <p>{dateStr} · 問題：{report.question}</p>
      </div>

      <div className="card" style={{ borderColor: 'rgba(139,92,246,.35)', background: 'rgba(139,92,246,.08)' }}>
        <h3>問題</h3>
        <p className="lead" style={{ margin: 0 }}>{report.question}</p>
      </div>

      {upgrading && (
        <div className="card" style={{ borderStyle: 'dashed' }}>
          <p className="lead" style={{ fontSize: 13, margin: 0 }}>
            ✨ AI 正在細讀你的命盤與問題，深度解讀約需 15–30 秒，會自動更新下方內容 <span className="loading-dots"><i /><i /><i /></span>
          </p>
        </div>
      )}

      <div className="card">
        <h3>🔮 命理觀點{(report.source === 'llm' || llmFields) ? ' · AI' : ''}</h3>
        <p className="lead" style={{ fontSize: 14, lineHeight: 1.7, margin: 0 }}>{llmFields?.astrology || report.astrology}</p>
      </div>

      {(llmFields?.timing || report.timing) && (
        <div className="card">
          <h3>⏳ 時機判斷</h3>
          <p className="lead" style={{ fontSize: 14, lineHeight: 1.7, margin: 0 }}>{llmFields?.timing || report.timing}</p>
        </div>
      )}

      <div className="card">
        <h3>💭 從你最近的狀態來看</h3>
        <p className="lead" style={{ fontSize: 14, lineHeight: 1.7, margin: 0 }}>{llmFields?.memory || report.memory}</p>
      </div>

      <div className="card">
        <h3>🌿 可以怎麼做</h3>
        <ol style={{ paddingLeft: 18, margin: 0, fontSize: 14, lineHeight: 1.8 }}>
          {(llmFields?.actions || report.actions).map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ol>
      </div>

      <div className="card">
        <h3>💬 繼續追問{userTurns > 0 && userTurns < MAX_CHAT_TURNS ? `（還可問 ${MAX_CHAT_TURNS - userTurns} 則）` : ''}</h3>
        {chatTurns.map((t, i) => (
          <p
            key={i}
            className="lead"
            style={{
              fontSize: 14,
              lineHeight: 1.7,
              marginBottom: 8,
              textAlign: t.role === 'user' ? 'right' : 'left',
              color: t.role === 'user' ? 'var(--gold-soft)' : 'var(--ink)',
            }}
          >
            {t.role === 'user' ? '你：' : '✦ '}{t.content}
          </p>
        ))}
        {sending && <p className="note" style={{ margin: '4px 0' }}>✨ 思考中 <span className="loading-dots"><i /><i /><i /></span></p>}
        {!aiOn ? (
          <p className="note mt8">AI 雲端功能目前關閉，到「我的與隱私」開啟後就能追問</p>
        ) : userTurns >= MAX_CHAT_TURNS ? (
          <p className="note mt8">這份報告的追問次數用完了，想聊新的主題就再問一件事吧</p>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input
              className="input"
              style={{ flex: 1, width: 'auto', minWidth: 0, padding: '10px 13px' }}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
              placeholder="針對這份報告再問一句…"
            />
            <button type="button" className="btn btn-gold" style={{ padding: '10px 16px', width: 'auto', flexShrink: 0 }} onClick={handleSend} disabled={!canSend}>
              送出
            </button>
          </div>
        )}
      </div>

      <div className="card" style={{ background: 'rgba(216,181,128,.07)' }}>
        <p className="small" style={{ margin: 0 }}>這份報告結合了你的本命盤與近期打卡，內容為自我探索與娛樂用途，不構成醫療、心理治療或投資建議。</p>
      </div>

      <p className="note center" style={{ fontSize: 12 }}>✓ 已自動存入報告庫，隨時可以回來看</p>

      <Link className="btn btn-ghost" to="/reports" style={{ marginBottom: 10 }}>← 返回報告列表</Link>
      <Link className="btn btn-gold" to="/ask">再問一件事 ✦</Link>

      <p className="disclaimer">內容為自我探索與娛樂用途</p>

      <TabBar active="ask" />
    </div>
  );
}
