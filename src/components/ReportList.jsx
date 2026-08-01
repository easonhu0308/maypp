import React from 'react';
import { Link } from 'react-router-dom';
import { ASK_CATEGORIES } from '../lib/daily.js';

const categoryLabel = (key) => {
  const c = ASK_CATEGORIES[key];
  return c ? `${c.icon} ${c.name}` : '🔮 問事';
};

// 報告庫列表（Ask 頁預覽與 Reports 頁共用）
export default function ReportList({ reports, limit }) {
  const list = limit ? reports.slice(0, limit) : reports;
  return (
    <>
      {list.map((r) => (
        <Link key={r.id} className="card" to={`/report-detail?id=${r.id}`} style={{ display: 'block', textDecoration: 'none', color: 'inherit', marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#9e92b3', marginBottom: 4 }}>
            {categoryLabel(r.category)} · {new Date(r.createdAt).toLocaleDateString('zh-Hant')}{r.source === 'llm' ? ' · AI' : ''}
          </div>
          <div style={{ fontWeight: 700, color: '#d4b5ff', marginBottom: 6 }}>{r.question}</div>
          <div className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>{r.astrology.slice(0, 60)}…</div>
        </Link>
      ))}
    </>
  );
}
