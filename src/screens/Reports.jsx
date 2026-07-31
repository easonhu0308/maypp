import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getReports } from '../lib/storage.js';
import TabBar from '../components/TabBar.jsx';

const CATEGORIES = {
  career: '💼 事業',
  love: '❤️ 感情',
  money: '💰 財運',
  health: '🏃 健康',
  social: '👥 人際',
  yearly: '📅 年度運勢',
};

export default function Reports() {
  const reports = useMemo(() => getReports(), []);

  return (
    <div className="app">
      <div className="page-head">
        <div className="eyebrow">REPORTS</div>
        <h1>懂我報告</h1>
        <p>根據你的命盤、流日與心情紀錄，為你產出的個人化解讀。</p>
      </div>

      {reports.length === 0 ? (
        <div className="card center" style={{ borderStyle: 'dashed' }}>
          <p className="lead">還沒有問事紀錄</p>
          <p className="muted">問一個你最近在想的事，我會結合命盤與你的狀態給你建議。</p>
          <Link className="btn btn-gold mt8" to="/ask">開始問一件事 ✦</Link>
        </div>
      ) : (
        <>
          <Link className="btn btn-gold" to="/ask" style={{ marginBottom: 16 }}>再問一件事 ✦</Link>
          {reports.map((r) => (
            <Link key={r.id} className="card" to={`/report-detail?id=${r.id}`} style={{ display: 'block', textDecoration: 'none', color: 'inherit', marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#9e92b3', marginBottom: 4 }}>{CATEGORIES[r.category] || '🔮 問事'} · {new Date(r.createdAt).toLocaleDateString('zh-Hant')}</div>
              <div style={{ fontWeight: 700, color: '#d4b5ff', marginBottom: 6 }}>{r.question}</div>
              <div className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>{r.astrology.slice(0, 60)}…</div>
            </Link>
          ))}
        </>
      )}

      <div className="card center" style={{ background: 'rgba(216,181,128,.07)' }}>
        <p className="lead">懂你紫微是做給朋友的免費小作品</p>
        <p className="small">沒有訂閱、沒有內購；問事報告永久保存，只存在你的手機裡。</p>
      </div>

      <p className="disclaimer">內容為自我探索與娛樂用途</p>

      <TabBar active="reports" />
    </div>
  );
}
