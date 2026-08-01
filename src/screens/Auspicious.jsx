import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getProfile, getSettings } from '../lib/storage.js';
import {
  AUSPICIOUS_ACTIVITIES,
  scanAuspiciousDays,
  localDayReason,
  formatDayLabel,
} from '../lib/auspicious.js';
import { fetchLlmAuspicious } from '../lib/llmAuspicious.js';
import TabBar from '../components/TabBar.jsx';

const ACTIVITIES = Object.entries(AUSPICIOUS_ACTIVITIES).map(([key, v]) => ({ key, ...v }));

export default function Auspicious() {
  const profile = useMemo(() => getProfile(), []);
  const [activityKey, setActivityKey] = useState('health');
  const [result, setResult] = useState(null); // { activity, days(with reason/title), intro, note, source }
  const [llmLoading, setLlmLoading] = useState(false);

  const handleScan = () => {
    const activity = AUSPICIOUS_ACTIVITIES[activityKey];
    const days = scanAuspiciousDays(profile, activityKey, { days: 30 });
    // 本地理由先秒開
    const local = {
      activity,
      intro: `未來 30 天裡，這 3 天最適合安排${activity.name}：`,
      days: days.map((d) => ({ ...d, title: '', reason: localDayReason(d, activity) })),
      note: '挑個順的日子，是幫自己多一份從容。',
      source: 'local',
    };
    setResult(local);

    // 背景取 LLM 版理由，回來無縫替換
    if (getSettings().aiDaily === false) return;
    setLlmLoading(true);
    fetchLlmAuspicious({ profile, activity, days }).then((llm) => {
      setLlmLoading(false);
      if (!llm) return;
      setResult((prev) => {
        if (!prev || prev.activity !== activity) return prev;
        const reasonByDate = {};
        for (const d of llm.days) reasonByDate[d.date] = d;
        return {
          ...prev,
          intro: llm.intro,
          note: llm.note || prev.note,
          source: 'llm',
          days: prev.days.map((d) => {
            const m = reasonByDate[d.date];
            return m ? { ...d, title: m.title, reason: m.reason } : d;
          }),
        };
      });
    });
  };

  return (
    <div className="app">
      <div className="page-head">
        <div className="eyebrow">AUSPICIOUS DAYS</div>
        <h1>挑個好日子</h1>
        <p>選一件想安排的事，掃描未來 30 天的流日，挑出最順的 3 天。</p>
      </div>

      <div className="card">
        <h3>想安排什麼？</h3>
        <div className="chips mt8">
          {ACTIVITIES.map((a) => (
            <button
              key={a.key}
              type="button"
              className={`chip${activityKey === a.key ? ' on' : ''}`}
              onClick={() => setActivityKey(a.key)}
            >
              {a.icon} {a.name}
            </button>
          ))}
        </div>
      </div>

      <button type="button" className="btn btn-gold" onClick={handleScan}>
        掃描未來 30 天 ✦
      </button>

      {llmLoading && (
        <div className="card" style={{ borderStyle: 'dashed' }}>
          <p className="lead" style={{ fontSize: 13, margin: 0 }}>✨ AI 正在為這 3 天寫推薦理由 <span className="loading-dots"><i /><i /><i /></span></p>
        </div>
      )}

      {result && (
        <>
          <div className="card glow">
            <h3>📅 {result.activity.icon} {result.activity.name}的好日子{result.source === 'llm' ? ' · AI' : ''}</h3>
            <p className="lead" style={{ fontSize: 14, lineHeight: 1.7 }}>{result.intro}</p>
          </div>

          {result.days.map((d) => (
            <div className="card" key={d.date}>
              <h3>{formatDayLabel(d.date)} · {d.ganzhi}日</h3>
              {d.title && <p className="lead" style={{ fontWeight: 700, margin: '4px 0' }}>{d.title}</p>}
              <p className="lead" style={{ fontSize: 14, lineHeight: 1.8 }}>{d.reason}</p>
              {d.hits.length > 0 && (
                <div className="chips mt8">
                  {d.hits.map((h) => (
                    <span key={h} className="chip" style={{ fontSize: 12, padding: '5px 10px' }}>{h}</span>
                  ))}
                </div>
              )}
            </div>
          ))}

          <div className="card" style={{ background: 'rgba(216,181,128,.07)' }}>
            <p className="small" style={{ margin: 0 }}>
              {result.note}　內容為自我探索與娛樂用途，重要安排請仍以現實條件為主。
            </p>
          </div>
        </>
      )}

      <Link className="btn btn-ghost mt8" to="/ask" style={{ fontSize: 13, padding: 12 }}>想用問的？對命盤問一件事 →</Link>
      <p className="disclaimer">內容為自我探索與娛樂用途</p>

      <TabBar active="ask" />
    </div>
  );
}
