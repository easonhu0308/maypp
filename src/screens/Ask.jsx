import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getProfile, getReports, recentCheckins, addReport } from '../lib/storage.js';
import { buildAstrolabe, getMingStarNames } from '../lib/astro.js';
import { buildAskReport, ASK_CATEGORIES } from '../lib/daily.js';
import ReportList from '../components/ReportList.jsx';
import TabBar from '../components/TabBar.jsx';

const CATEGORIES = Object.entries(ASK_CATEGORIES).map(([key, v]) => ({
  key,
  label: `${v.icon} ${v.name}`,
  desc: v.desc,
}));

export default function Ask() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const profile = getProfile();
  const astrolabe = useMemo(() => buildAstrolabe(profile), [profile]);
  const mingStars = useMemo(() => getMingStarNames(astrolabe), [astrolabe]);
  const recent = useMemo(() => recentCheckins(7), []);

  const initialCategory = searchParams.get('category') || 'career';
  const [category, setCategory] = useState(CATEGORIES.some((c) => c.key === initialCategory) ? initialCategory : 'career');
  const [question, setQuestion] = useState('');
  const reports = useMemo(() => getReports(), []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const report = buildAskReport({ category, question, profile, mingStars, recent });
    addReport(report);
    navigate(`/report-detail?id=${report.id}`);
  };

  return (
    <div className="app">
      <div className="page-head">
        <div className="eyebrow">ASK</div>
        <h1>問一件事</h1>
        <p>選擇一個領域，我會結合你的命盤與最近狀態，給你一份帶推理的建議。</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card">
          <h3>想聊什麼？</h3>
          <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategory(c.key)}
                className="btn"
                style={{
                  textAlign: 'left',
                  background: category === c.key ? 'rgba(139,92,246,.18)' : '#1e1e2d',
                  borderColor: category === c.key ? '#8b5cf6' : '#2f2f45',
                  color: category === c.key ? '#f3effa' : '#9e92b3',
                  fontWeight: category === c.key ? 700 : 400,
                }}
              >
                <div>{c.label}</div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{c.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <h3>具體一點的問題（選填）</h3>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={4}
            placeholder="例如：這週適合跟主管提案嗎？"
            style={{
              width: '100%',
              marginTop: 12,
              background: '#181824',
              border: '1px solid #2f2f45',
              borderRadius: 12,
              padding: 12,
              color: '#f3effa',
              fontSize: 14,
              resize: 'none',
            }}
          />
        </div>

        <div className="card" style={{ background: 'rgba(139,92,246,.08)' }}>
          <h3>會參考的資訊</h3>
          <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.7 }}>
            命宮主星：{mingStars.join('、') || '—'}<br />
            五行局：{astrolabe.fiveElementsClass}<br />
            近 7 日打卡：{recent.length} 則
          </p>
        </div>

        <button type="submit" className="btn btn-gold">生成懂我報告</button>
        <Link className="btn btn-ghost mt8" to="/auspicious" style={{ fontSize: 13, padding: 12 }}>想挑日子？掃描未來 30 天 📅</Link>
        <p className="disclaimer">內容為自我探索與娛樂用途</p>
      </form>

      {reports.length > 0 && (
        <div className="mt16">
          <h3 style={{ marginBottom: 10 }}>❖ 我的報告庫</h3>
          <ReportList reports={reports} limit={3} />
          {reports.length > 3 && (
            <Link className="btn btn-ghost" to="/reports" style={{ fontSize: 13, padding: 12 }}>
              查看全部 {reports.length} 份報告 →
            </Link>
          )}
        </div>
      )}

      <TabBar active="ask" />
    </div>
  );
}
