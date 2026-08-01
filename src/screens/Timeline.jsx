import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getProfile, getCheckins, recentCheckins } from '../lib/storage.js';
import { buildAstrolabe, getMingStarNames } from '../lib/astro.js';
import { formatShortLabel } from '../lib/time.js';
import TabBar from '../components/TabBar.jsx';

const INSIGHT_TIPS = {
  工作卡關: { text: '最近「工作卡關」出現比較多次。要不要針對事業問一件事，把卡住點攤開來看？', link: '/ask?category=career' },
  有點疲憊: { text: '你最近標了幾次疲憊。身體的訊號值得被認真對待，要不要看看健康方向的建議？', link: '/ask?category=health' },
  想被鼓勵: { text: '你想被鼓勵，那我們就主動一點：今天給自己一個小肯定，也可以問問年度運勢怎麼走。', link: '/ask?category=yearly' },
  感情甜蜜: { text: '最近感情狀態不錯，趁這個時機多懂一點自己的關係模式也不錯。', link: '/ask?category=love' },
  家庭瑣事: { text: '家庭相關的標籤出現了。如果你覺得消耗，可以針對人際關係問一件事。', link: '/ask?category=social' },
  意外驚喜: { text: '最近有意外驚喜，保持開放，看看財運方向有沒有值得留意的訊號。', link: '/ask?category=money' },
};

export default function Timeline() {
  const profile = getProfile();
  const checkins = getCheckins().slice().reverse(); // 新的在前
  const mingStars = getMingStarNames(buildAstrolabe(profile));
  const recent = useMemo(() => recentCheckins(30), []);

  const insight = useMemo(() => {
    const counts = {};
    for (const c of recent) {
      for (const tag of c.tags || []) {
        counts[tag] = (counts[tag] || 0) + 1;
      }
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const top = sorted.find(([tag]) => INSIGHT_TIPS[tag]);
    return top ? INSIGHT_TIPS[top[0]] : null;
  }, [recent]);

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

      {insight && (
        <div className="card" style={{ borderColor: 'rgba(139,92,246,.35)', background: 'rgba(139,92,246,.08)' }}>
          <h3>💡 越來越懂你</h3>
          <p className="lead" style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 10 }}>{insight.text}</p>
          <Link className="btn btn-ghost btn-sm" to={insight.link} style={{ fontSize: 12 }}>去問問看 →</Link>
        </div>
      )}

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

      <TabBar active="timeline" />
    </div>
  );
}
