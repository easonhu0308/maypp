import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addCheckin, getCheckins, calcStreak } from '../lib/storage.js';
import { toISODate } from '../lib/time.js';
import TabBar from '../components/TabBar.jsx';
import Toast, { useToast } from '../components/Toast.jsx';

const MOODS = ['😞', '😕', '😐', '🙂', '😄'];
const EVENT_TAGS = ['工作卡關', '被稱讚了', '感情甜蜜', '有點疲憊', '家庭瑣事', '意外驚喜', '和朋友聚餐', '想被鼓勵', '平靜的一天'];

export default function Checkin() {
  const navigate = useNavigate();
  const toast = useToast();
  const [mood, setMood] = useState(4); // 1–5，預設 🙂
  const [tags, setTags] = useState([]);
  const [text, setText] = useState('');
  const streak = calcStreak(getCheckins());

  const toggleTag = (tag) =>
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));

  const submit = () => {
    if (!mood) return toast.show('先選一個今天的心情吧');
    addCheckin({ date: toISODate(), mood, emoji: MOODS[mood - 1], tags, text: text.trim() });
    navigate('/timeline');
  };

  return (
    <div className="app">
      <div className="page-head">
        <div className="eyebrow">CHECK-IN · 30 秒</div>
        <h1>今天過得怎麼樣？</h1>
        <p>你說的每一件小事，都會成為明天日報的養分。</p>
      </div>

      <div className="card glow">
        <h3>現在的心情</h3>
        <div className="chips mt8" style={{ justifyContent: 'space-between' }}>
          {MOODS.map((emoji, i) => (
            <span
              key={emoji}
              className={`chip${mood === i + 1 ? ' on' : ''}`}
              style={{ fontSize: 20, padding: '10px 13px' }}
              onClick={() => setMood(i + 1)}
            >
              {emoji}
            </span>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>今天發生了什麼？（可複選）</h3>
        <div className="chips mt8">
          {EVENT_TAGS.map((tag) => (
            <span key={tag} className={`chip${tags.includes(tag) ? ' on' : ''}`} onClick={() => toggleTag(tag)}>
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>想多說一點嗎？（選填）</h3>
        <textarea
          className="input mt8"
          placeholder="例如：開會時被主管打槍，有點挫折……"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <p className="note mt8">這些內容只有你看得見，可隨時刪除。我們不會把它用於個人化以外的用途。</p>
      </div>

      <button className="btn btn-gold" onClick={submit}>送出 ✦</button>
      <p className="note center mt8">
        {streak > 0 ? `連續打卡 ${streak} 天 · 繼續保持，讓日報越來越懂你` : '今天的第一則打卡，從這裡開始'}
      </p>
      <p className="disclaimer">內容為自我探索與娛樂用途 · 資料可隨時匯出與刪除</p>

      <TabBar active="today" />
      <Toast msg={toast.msg} />
    </div>
  );
}
