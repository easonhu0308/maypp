import React from 'react';
import { Link } from 'react-router-dom';
import { getProfile, getCheckins } from '../lib/storage.js';
import { formatDots, toISODate } from '../lib/time.js';
import TabBar from '../components/TabBar.jsx';

export default function ReportDetail() {
  const profile = getProfile();
  const checkinCount = getCheckins().length;

  return (
    <div className="app">
      <div className="page-head">
        <div className="eyebrow">REPORT</div>
        <h1>💞 感情深度解析</h1>
        <p>{profile.nickname}專屬 · 依 {formatDots(toISODate())} 的命盤與近況生成 · 約 6,000 字</p>
      </div>

      <div className="card glow">
        <h3>第一章 · 你愛人的方式</h3>
        <p className="lead">你的夫妻宮坐貪狼，命宮卻是天機太陰——這是一組很迷人的矛盾：內心渴望深刻而專一的連結，表現出來的卻常常是「好像都可以」。你不是不在意，是太怕給別人添麻煩，於是把在意藏得很深。</p>
        <p className="mt8">上個月你打卡說「不知道他在想什麼」。其實盤上看得清楚：你需要的是「被明確選擇」的安全感，而你給出的訊號，卻常常模糊到對方讀不懂……</p>
      </div>

      <div className="card">
        <h3>第二至六章 · 製作中，一樣免費</h3>
        <p>你的親密關係盲點、下半年桃花節奏、與不同主星類型的相處攻略、給你的三個練習。</p>
        <p className="note mt8">完整六章將在 AI 生成引擎接上後自動解鎖，到時候回來就能免費看完整版。</p>
      </div>

      <div className="card">
        <h3>這份報告怎麼來的？</h3>
        <p>① 你的本命盤：夫妻宮、福德宮、紅鸞天喜位置<br />② 你的性格測驗：高敏感 × 高謹慎的依附傾向<br />③ 你這些日子以來的打卡：{checkinCount} 則心情與生活紀錄</p>
      </div>

      <div className="card center glow">
        <div className="price">免費 <small>· 朋友版 · 永久保存</small></div>
        <p className="mt8" style={{ fontSize: 12.5 }}>打卡越多次，報告越懂你</p>
        <Link className="btn btn-gold mt8" to="/checkin">先去打卡 30 秒 ✦</Link>
      </div>

      <p className="disclaimer">內容為自我探索與娛樂用途 · 不構成感情或心理諮詢建議</p>

      <TabBar active="reports" />
    </div>
  );
}
