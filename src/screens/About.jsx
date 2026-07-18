import React from 'react';
import { Link } from 'react-router-dom';
import TabBar from '../components/TabBar.jsx';

export default function About() {
  return (
    <div className="app">
      <div className="page-head center" style={{ paddingTop: 22 }}>
        <div style={{ fontSize: 30 }}>✦</div>
        <div className="eyebrow" style={{ marginTop: 4 }}>ABOUT</div>
        <h1>關於紫微拾光</h1>
        <p>一個做給朋友的免費小作品。</p>
      </div>

      <div className="card glow">
        <h3>💛 為什麼免費？</h3>
        <p className="lead">因為這是作者寫給朋友的禮物。沒有訂閱、沒有內購、沒有廣告——打開、排盤、看日報，就這麼簡單。如果它陪你度過了某個需要一點力量的早晨，那就夠了。</p>
      </div>

      <div className="card">
        <h3>🔒 你的資料在哪裡？</h3>
        <p>全部只存在<strong style={{ color: 'var(--gold-soft)' }}>你這支手機</strong>裡（瀏覽器本機儲存）。沒有帳號、沒有伺服器、什麼都不上傳。想刪掉？到「我的」一鍵清除，乾乾淨淨。</p>
      </div>

      <div className="card">
        <h3>✦ 內容是怎麼來的？</h3>
        <p>命盤由固定演算法（iztro 紫微斗數排盤庫）計算，星曜位置精確可驗證；日報文字結合你的命盤與每日打卡，以正向心理學框架撰寫——只給行動建議與鼓勵，不做負面斷言。</p>
      </div>

      <div className="card">
        <h3>🌿 重要的小事</h3>
        <p>紫微拾光是自我探索與娛樂用途，不提供醫療、心理治療或投資建議。如果你最近真的很累、很辛苦了，請找專業的人陪你：安心專線 1925 · 生命線 1995 · 張老師 1980。</p>
      </div>

      <Link className="btn btn-gold" to="/today">回到今日日報 ☀</Link>
      <p className="disclaimer">紫微拾光 · 朋友版 · 內容為自我探索與娛樂用途</p>

      <TabBar active="reports" />
    </div>
  );
}
