import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getProfile,
  getCheckins,
  getReports,
  getSettings,
  saveSettings,
  exportAllData,
  clearAllData,
} from '../lib/storage.js';
import { formatDots, timeSlotName, toISODate, daysBetween } from '../lib/time.js';
import TabBar from '../components/TabBar.jsx';
import Toast, { useToast } from '../components/Toast.jsx';

const TOGGLES = [
  { key: 'personalize', title: '個人化內容生成', sub: '使用打卡與測驗資料讓日報更貼近你' },
  { key: 'aiDaily', title: 'AI 雲端日報', sub: '命盤主星與打卡摘要會傳到雲端（Moonshot Kimi）生成日報；關閉則完全離線' },
  { key: 'push', title: '每日運勢推播', sub: '每天 08:00，可調整或關閉' },
  { key: 'stats', title: '匿名統計改善服務', sub: '僅彙總數據，不含可識別內容' },
];

export default function Privacy() {
  const navigate = useNavigate();
  const toast = useToast();
  const profile = getProfile();
  const checkins = getCheckins();
  const reports = getReports();
  const [settings, setSettings] = useState(() => {
    const s = getSettings();
    return { aiDaily: true, ...s, push: profile.consents?.push ?? s.push };
  });

  const joinDays = Math.max(1, daysBetween(profile.createdAt, toISODate()) + 1);

  const toggle = (key) => {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    saveSettings(next);
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(exportAllData(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dongni-ziwei-export-${toISODate()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.show('已匯出你的全部資料 ✦');
  };

  const deleteAll = () => {
    if (window.confirm('確定要永久刪除所有資料嗎？出生資料、打卡紀錄都會從這個裝置移除，無法復原。')) {
      clearAllData();
      navigate('/onboarding', { replace: true });
    }
  };

  return (
    <div className="app">
      <div className="page-head">
        <div className="eyebrow">PROFILE & PRIVACY</div>
        <h1>{profile.nickname}</h1>
        <p>加入 {joinDays} 天 · {checkins.length} 則打卡 · 免費版</p>
      </div>

      <div className="card glow">
        <div className="row"><span>✦ 我的命盤資料</span><span className="sub">{formatDots(profile.solarDate)} {timeSlotName(profile.timeIndex)}時</span></div>
        <div className="row"><span>🌿 生活分享紀錄</span><span className="sub">{checkins.length} 則打卡</span></div>
        <div className="row" style={{ border: 'none' }}><span>❖ 問事報告</span><span className="sub">{reports.length} 份</span></div>
      </div>

      {profile.goals?.length > 0 && (
        <div className="card">
          <h3>我的身心靈目標</h3>
          <div className="chips mt8">
            {profile.goals.map((g) => (
              <span key={g} className="chip on">{g}</span>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h3>我的資料，我做主</h3>
        {TOGGLES.map((t) => (
          <div className="row" key={t.key}>
            <div>{t.title}<div className="sub">{t.sub}</div></div>
            <div className={`switch${settings[t.key] ? ' on' : ''}`} onClick={() => toggle(t.key)}></div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>資料權利</h3>
        <div className="row">
          <span>📦 匯出我的全部資料</span>
          <a style={{ color: 'var(--gold)', fontSize: 13, textDecoration: 'none', cursor: 'pointer' }} onClick={exportData}>申請</a>
        </div>
        <div className="row">
          <span>📄 隱私權政策 / 服務條款</span>
          <a style={{ color: 'var(--gold)', fontSize: 13, textDecoration: 'none', cursor: 'pointer' }} onClick={() => toast.show('MVP 原型 · 頁面建置中')}>查看</a>
        </div>
        <div className="row" style={{ border: 'none' }}>
          <span style={{ color: 'var(--danger)' }}>永久刪除帳號與所有資料</span>
          <a style={{ color: 'var(--danger)', fontSize: 13, textDecoration: 'none', cursor: 'pointer' }} onClick={deleteAll}>執行</a>
        </div>
        <p className="note mt8">刪除會立即移除此裝置上的所有資料（出生資料、打卡內容與設定），無法復原。</p>
      </div>

      <p className="disclaimer">懂你紫微為自我探索與娛樂用途 · 不提供醫療、心理治療或投資建議</p>

      <TabBar active="privacy" />
      <Toast msg={toast.msg} />
    </div>
  );
}
