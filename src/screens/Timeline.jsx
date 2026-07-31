import React from 'react';
import { getProfile, getCheckins } from '../lib/storage.js';
import { buildAstrolabe, getMingStarNames } from '../lib/astro.js';
import { formatShortLabel } from '../lib/time.js';
import TabBar from '../components/TabBar.jsx';

export default function Timeline() {
  const profile = getProfile();
  const checkins = getCheckins().slice().reverse(); // 新的在前
  const mingStars = getMingStarNames(buildAstrolabe(profile));

  const tagCount = checkins.reduce((n, c) => n + (c.tags || []).length, 0);

  return (
    <div className="app">
      <div className="page-head">
        <div className="eyebrow">JOURNEY</div>
        <h1>我們一起走的路</h1>
        <p>懂你紫微記得你說過的事，也記得你是怎麼一步步走過來的。</p>
      </div>

      <div className="card glow mb16">
        <p className="lead" style={{ fontFamily: 'var(--serif)', fontSize: 15.5, lineHeight: 1.9 }}>
          {checkins.length > 0
            ? `「這段日子你留下了 ${checkins.length} 則紀錄、${tagCount} 個生活標籤。你說的每一件事，都在讓明天的日報更懂你。」`
            : '「故事才剛開始。今天的第一則打卡，會成為明天日報記得你的第一件事。」'}
        </p>
      </div>

      <div className="tl">
        {checkins.map((c, i) => (
          <div className="tl-item" key={`${c.date}-${i}`}>
            <div className="date">{formatShortLabel(c.date)} · 心情 {c.emoji}</div>
            <div className="body">
              {c.text ? <>你說「{c.text}」。</> : null}
              {c.tags && c.tags.length > 0 && (
                <> 你標記了 <b>{c.tags.join('、')}</b>。</>
              )}
              {!c.text && (!c.tags || c.tags.length === 0) && '靜靜打了一張卡，把心情留給自己。'}
            </div>
          </div>
        ))}
        <div className="tl-item">
          <div className="date">{formatShortLabel(profile.createdAt)} · 加入懂你紫微</div>
          <div className="body">
            排出命盤：命宮{mingStars.length ? mingStars.join('') : '無主星'}，{profile.solarDate} 的故事從這裡開始。
          </div>
        </div>
      </div>

      <div className="card mt16 center" style={{ borderStyle: 'dashed' }}>
        <p style={{ color: 'var(--ink-dim)' }}>🌱 完整「月度回顧報告」製作中：心情 × 運勢 × 行動的交叉分析，上線後一樣免費</p>
      </div>

      <p className="disclaimer">內容為自我探索與娛樂用途</p>

      <TabBar active="today" />
    </div>
  );
}
