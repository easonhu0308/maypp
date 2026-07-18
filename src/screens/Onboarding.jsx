import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TIME_SLOTS, toISODate } from '../lib/time.js';
import { saveProfile } from '../lib/storage.js';
import Toast, { useToast } from '../components/Toast.jsx';

export default function Onboarding() {
  const navigate = useNavigate();
  const toast = useToast();
  const [solarDate, setSolarDate] = useState('1994-06-18');
  const [timeIndex, setTimeIndex] = useState(4);
  const [genderRaw, setGenderRaw] = useState('女'); // 男 / 女 / 其他
  const [nickname, setNickname] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeData, setAgreeData] = useState(false);
  const [agreePush, setAgreePush] = useState(false);

  const submit = () => {
    if (!solarDate) return toast.show('請選擇出生日期');
    if (timeIndex === null || timeIndex === undefined) return toast.show('請選擇出生時辰');
    if (!agreeTerms || !agreeData) return toast.show('請勾選兩項必要同意，才能繼續');
    saveProfile({
      nickname: nickname.trim() || '旅人',
      solarDate,
      timeIndex: Number(timeIndex),
      genderRaw,
      // iztro 需要二元性別以排大限順逆；「其他／不透露」以「男」計算
      gender: genderRaw === '女' ? '女' : '男',
      consents: { terms: agreeTerms, data: agreeData, push: agreePush },
      createdAt: toISODate(),
    });
    navigate('/chart');
  };

  return (
    <div className="app">
      <div className="page-head center" style={{ paddingTop: 26 }}>
        <div style={{ fontSize: 34, letterSpacing: '.1em' }}>✦</div>
        <div className="eyebrow" style={{ marginTop: 6 }}>ZIWEI LIGHT</div>
        <h1 style={{ fontSize: 28 }}>紫微拾光</h1>
        <p>排一張屬於你的命盤，<br />開始一段越來越懂你的每日陪伴。</p>
      </div>

      <div className="steps"><i className="done"></i><i className="done"></i><i></i></div>

      <div className="card glow">
        <h3>① 你的出生資料</h3>
        <p className="mb16">紫微斗數以出生年月日時排盤，資料僅用於命盤計算與個人化內容。</p>
        <div className="field">
          <label>出生日期（國曆）</label>
          <input className="input" type="date" value={solarDate} onChange={(e) => setSolarDate(e.target.value)} />
        </div>
        <div className="field">
          <label>出生時辰</label>
          <div className="chips">
            {TIME_SLOTS.map((s) => (
              <span
                key={s.index}
                className={`chip${timeIndex === s.index ? ' on' : ''}`}
                onClick={() => setTimeIndex(s.index)}
              >
                {s.name} {s.range}
              </span>
            ))}
          </div>
        </div>
        <div className="field">
          <label>性別（用於大限順逆排法）</label>
          <div className="chips">
            {['女', '男', '其他／不透露'].map((g) => (
              <span
                key={g}
                className={`chip${(g === '其他／不透露' ? '其他' : g) === genderRaw ? ' on' : ''}`}
                onClick={() => setGenderRaw(g === '其他／不透露' ? '其他' : g)}
              >
                {g}
              </span>
            ))}
          </div>
          {genderRaw === '其他' && (
            <p className="note mt8">紫微斗數的大限順逆需要二元性別；選擇不透露時，將暫以「男」的排法計算，不影響命宮與星曜位置。</p>
          )}
        </div>
        <div className="field" style={{ marginBottom: 6 }}>
          <label>怎麼稱呼你（可匿名暱稱）</label>
          <input
            className="input"
            type="text"
            placeholder="例如：小曦"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={12}
          />
        </div>
      </div>

      <div className="card">
        <h3>② 你的同意，我們說清楚</h3>
        <div className="checkrow mt8">
          <input type="checkbox" id="c1" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} />
          <label htmlFor="c1">我已閱讀並同意<a>《服務條款》</a>與<a>《隱私權政策》</a>，了解出生資料屬於個人資料，僅用於排盤與內容生成。</label>
        </div>
        <div className="checkrow">
          <input type="checkbox" id="c2" checked={agreeData} onChange={(e) => setAgreeData(e.target.checked)} />
          <label htmlFor="c2">我同意分享心情、工作與感情近況等<strong>自願提供的生活資訊</strong>，用來讓日報更貼近我。我可以隨時在設定中撤回或刪除。</label>
        </div>
        <div className="checkrow" style={{ marginBottom: 4 }}>
          <input type="checkbox" id="c3" checked={agreePush} onChange={(e) => setAgreePush(e.target.checked)} />
          <label htmlFor="c3">我願意收到每日運勢推播（可隨時關閉）。</label>
        </div>
        <p className="note mt8">本 App 為自我探索與娛樂用途，不提供醫療、心理治療或投資建議。未滿 18 歲請由監護人陪同使用。</p>
      </div>

      <button className="btn btn-gold mt8" onClick={submit}>排出我的命盤 ✦</button>
      <p className="disclaimer">內容為自我探索與娛樂用途 · 資料可隨時匯出與刪除</p>
      <Toast msg={toast.msg} />
    </div>
  );
}
