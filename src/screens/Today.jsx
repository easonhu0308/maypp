import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getProfile, getSettings, recentCheckins } from '../lib/storage.js';
import { buildAstrolabe, getMingStarNames } from '../lib/astro.js';
import { buildDailyReport } from '../lib/daily.js';
import { fetchLlmDailyFields } from '../lib/llmDaily.js';
import { formatDateLabel } from '../lib/time.js';
import TabBar from '../components/TabBar.jsx';

export default function Today() {
  const profile = getProfile();
  const aiDailyOn = getSettings().aiDaily !== false;
  const now = useMemo(() => new Date(), []);
  const mingStars = useMemo(() => getMingStarNames(buildAstrolabe(profile)), [profile]);
  // 先同步產生本地模板日報（保證秒開），LLM 回來後無縫替換
  const [report, setReport] = useState(() => buildDailyReport(profile, mingStars, recentCheckins(7), now));

  useEffect(() => {
    let alive = true;
    fetchLlmDailyFields(profile, mingStars, recentCheckins(7), now).then((fields) => {
      if (alive && fields) setReport((prev) => ({ ...prev, ...fields }));
    });
    return () => { alive = false; };
  }, [profile, mingStars, now]);

  return (
    <div className="app">
      <div className="page-head">
        <div className="eyebrow">DAILY · {formatDateLabel(now)}{report.source === 'llm' ? ' · AI' : ''}</div>
        <h1>{report.greeting}，{profile.nickname}</h1>
        <p>{report.dayGanzhi}日 · {report.dayKeyword}</p>
      </div>

      <div className="card glow">
        <div className="score-ring">
          <div className="ring" style={{ '--p': report.score }}><b>{report.score}</b><span>今日能量</span></div>
          <div style={{ flex: 1 }}>
            <p className="lead" style={{ fontSize: 14 }}>{report.lead}</p>
            <div className="dim"><span className="name">事業</span><div className="bar"><b className="b-career" style={{ width: `${report.dims.career}%` }}></b></div><span className="val">{report.dims.career}</span></div>
            <div className="dim"><span className="name">感情</span><div className="bar"><b className="b-love" style={{ width: `${report.dims.love}%` }}></b></div><span className="val">{report.dims.love}</span></div>
            <div className="dim"><span className="name">財運</span><div className="bar"><b className="b-money" style={{ width: `${report.dims.money}%` }}></b></div><span className="val">{report.dims.money}</span></div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>🌿 今日行動建議</h3>
        <p className="lead">{report.advice}</p>
        <div className="chips mt8">
          {report.yi.map((y, i) => (
            <span key={y} className={`chip${i < 2 ? ' on' : ''}`}>{y}</span>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>💛 給你的一句話</h3>
        <p className="lead" style={{ fontFamily: 'var(--serif)', fontSize: 16, lineHeight: 1.9 }}>
          {report.encouragement}
        </p>
      </div>

      <div className="card" style={{ background: 'rgba(216,181,128,.07)' }}>
        <h3>✨ 今日小物</h3>
        <div className="chips mt8">
          <span className="chip">幸運色：{report.lucky.color}</span>
          <span className="chip">幸運數字：{report.lucky.number}</span>
          <span className="chip">方位：{report.lucky.direction}</span>
        </div>
      </div>

      <Link className="btn btn-gold" to="/checkin">今日 30 秒打卡，讓明天更懂你 ✦</Link>

      <div className="card mt16 center" style={{ borderStyle: 'dashed' }}>
        <p style={{ color: 'var(--ink-dim)' }}>✦ 覺得準嗎？把懂你紫微分享給朋友，一起排排盤</p>
        <p className="note mt8">{aiDailyOn ? '永久免費 · AI 日報由雲端生成，你的資料只存在這支手機裡' : '永久免費 · 你的資料只存在這支手機裡'}</p>
      </div>

      <p className="disclaimer">內容為自我探索與娛樂用途</p>

      <TabBar active="today" />
    </div>
  );
}
