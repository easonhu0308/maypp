import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getProfile, getCheckins, recentCheckins, addReport } from '../lib/storage.js';
import { buildAstrolabe, getMingStarNames } from '../lib/astro.js';
import { buildAskReport } from '../lib/daily.js';
import TabBar from '../components/TabBar.jsx';

const CATEGORIES = [
  { key: 'career', label: '💼 事業', desc: '工作方向、轉職、提案時機' },
  { key: 'love', label: '❤️ 感情', desc: '關係理解、相處節奏' },
  { key: 'money', label: '💰 財運', desc: '投資、消費、談錢時機' },
  { key: 'health', label: '🏃 健康', desc: '作息、身體訊號、調養' },
  { key: 'social', label: '👥 人際', desc: '朋友、合作、溝通' },
  { key: 'yearly', label: '📅 年度運勢', desc: '大方向與年度重點' },
];

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
        <p className="disclaimer">內容為自我探索與娛樂用途</p>
      </form>

      <TabBar active="reports" />
    </div>
  );
}
