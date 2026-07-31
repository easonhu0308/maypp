import React from 'react';
import { Link } from 'react-router-dom';
import TabBar from '../components/TabBar.jsx';

const REPORTS = [
  {
    tag: '最多人看',
    title: '💞 感情深度解析',
    desc: '夫妻宮 × 紅鸞天喜 × 你的感情觀，解析你的親密關係模式與下半年的桃花節奏。約 6,000 字。',
    price: '免費',
    glow: true,
  },
  {
    title: '🧭 職涯流年解析',
    desc: '官祿宮 × 大限走向 × 你的性格優勢：適合你的賽道、轉職時機與未來三年的事業節奏。約 5,000 字。',
    price: '免費',
  },
  {
    title: '🌊 2026 流年總運',
    desc: '丙午年十二宮全解析：每個月的能量高低、貴人方位、該進該守的節奏，一次掌握。約 8,000 字。',
    price: '免費',
  },
  {
    tag: '即將推出',
    soon: true,
    title: '💑 兩人合盤',
    desc: '兩張命盤的互動模式：你們怎麼相愛、怎麼吵架、怎麼走得更遠。需對方出生資料。約 7,000 字。',
    price: '免費',
  },
];

export default function Reports() {
  return (
    <div className="app">
      <div className="page-head">
        <div className="eyebrow">DEEP REPORTS</div>
        <h1>為你而寫的深度報告</h1>
        <p>以你的命盤為底、你這些日子的分享為料，一份只屬於你的解析。全部免費，永久保存，隨時重讀。</p>
      </div>

      {REPORTS.map((r) => (
        <div key={r.title} className={`card${r.glow ? ' glow' : ''}`}>
          <div className="row" style={{ border: 'none', padding: 0 }}>
            <div style={{ flex: 1 }}>
              {r.tag && <span className="tag">{r.tag}</span>}
              <h3 style={r.tag ? { marginTop: 8 } : undefined}>{r.title}</h3>
              <p>{r.desc}</p>
            </div>
          </div>
          <div className="row" style={{ border: 'none', padding: '12px 0 0' }}>
            <span className="price">{r.price}</span>
            {r.soon ? (
              <span className="btn btn-ghost btn-sm" style={{ opacity: 0.45, pointerEvents: 'none' }}>製作中</span>
            ) : (
              <Link className={`btn ${r.glow ? 'btn-gold' : 'btn-ghost'} btn-sm`} to="/report-detail">開始閱讀</Link>
            )}
          </div>
        </div>
      ))}

      <div className="card center" style={{ background: 'rgba(216,181,128,.07)' }}>
        <p className="lead">懂你紫微是做給朋友的免費小作品</p>
        <p>沒有訂閱、沒有內購；命盤與打卡存在你手機，「AI 雲端日報」可隨時關閉。</p>
        <Link className="btn btn-ghost btn-sm mt8" to="/about">關於懂你紫微</Link>
      </div>

      <p className="disclaimer">內容為自我探索與娛樂用途</p>

      <TabBar active="reports" />
    </div>
  );
}
