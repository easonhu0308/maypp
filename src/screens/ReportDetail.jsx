import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getProfile, getReports, getSettings, recentCheckins, updateReport } from '../lib/storage.js';
import { ASK_CATEGORIES } from '../lib/daily.js';
import { fetchLlmAskReport } from '../lib/llmAsk.js';
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
        <TabBar active="reports" />
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
            ✨ AI 正在細讀你的命盤與問題，深度解讀約需 15–30 秒，會自動更新下方內容…
          </p>
        </div>
      )}

      <div className="card">
        <h3>🔮 命理觀點{(report.source === 'llm' || llmFields) ? ' · AI' : ''}</h3>
        <p className="lead" style={{ fontSize: 14, lineHeight: 1.7, margin: 0 }}>{llmFields?.astrology || report.astrology}</p>
      </div>

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

      <div className="card" style={{ background: 'rgba(216,181,128,.07)' }}>
        <p className="small" style={{ margin: 0 }}>這份報告結合了你的本命盤與近期打卡，內容為自我探索與娛樂用途，不構成醫療、心理治療或投資建議。</p>
      </div>

      <Link className="btn btn-ghost" to="/reports" style={{ marginBottom: 10 }}>← 返回報告列表</Link>
      <Link className="btn btn-gold" to="/ask">再問一件事 ✦</Link>

      <p className="disclaimer">內容為自我探索與娛樂用途</p>

      <TabBar active="reports" />
    </div>
  );
}
