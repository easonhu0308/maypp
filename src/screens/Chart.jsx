import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getProfile, getSettings } from '../lib/storage.js';
import { fetchLlmChartReport } from '../lib/llmChart.js';
import { fetchLlmHoroscope } from '../lib/llmHoroscope.js';
import {
  buildAstrolabe,
  CHART_ORDER,
  displayPalaceName,
  getMingStarNames,
  getYinYang,
  lunarDateShort,
  palaceStarLines,
} from '../lib/astro.js';
import { describePattern } from '../lib/geju.js';
import { formatDots, timeSlotName } from '../lib/time.js';
import TabBar from '../components/TabBar.jsx';

function PalaceCell({ palace }) {
  const { major, minor } = palaceStarLines(palace);
  const isMing = palace.name === '命宮';
  return (
    <div className={`palace${isMing ? ' ming' : ''}`}>
      <span className="p-name">{displayPalaceName(palace.name)}</span>
      <span className="p-stars">
        <span className="main">{major.length ? major.join(' ') : '—'}</span>
        {minor.length > 0 && (
          <>
            <br />
            <span className="minor">{minor.join(' ')}</span>
          </>
        )}
      </span>
      {palace.isBodyPalace && <span className="body-mark">身宮</span>}
      <span className="dz">{palace.earthlyBranch}</span>
    </div>
  );
}

const DIM_TABS = [
  { key: 'personality', label: '性格本質' },
  { key: 'career', label: '事業' },
  { key: 'love', label: '感情' },
  { key: 'money', label: '財運' },
  { key: 'social', label: '人際' },
];

export default function Chart() {
  // getProfile() 每次都回傳新物件，必須記憶化，否則 useEffect 依賴會一直變、
  // 快取命中時 setDeep 造成無限 re-render
  const profile = useMemo(() => getProfile(), []);
  const [deep, setDeep] = useState(null);
  const [dim, setDim] = useState('personality');
  // AI 關閉時不顯示等待提示；開啟時先假設會生成，失敗再靜默收起
  const [deepLoading, setDeepLoading] = useState(() => getSettings().aiDaily !== false);
  const [horo, setHoro] = useState(null);
  const [horoLoading, setHoroLoading] = useState(() => getSettings().aiDaily !== false);

  useEffect(() => {
    let alive = true;
    fetchLlmChartReport(profile).then((report) => {
      if (!alive) return;
      if (report) setDeep(report);
      setDeepLoading(false);
    });
    fetchLlmHoroscope(profile).then((report) => {
      if (!alive) return;
      if (report) setHoro(report);
      setHoroLoading(false);
    });
    return () => { alive = false; };
  }, [profile]);

  const astrolabe = useMemo(() => buildAstrolabe(profile), [profile]);
  const byBranch = useMemo(() => {
    const map = {};
    for (const p of astrolabe.palaces) map[p.earthlyBranch] = p;
    return map;
  }, [astrolabe]);
  const mingStars = getMingStarNames(astrolabe);
  const yinYang = getYinYang(astrolabe);

  // LLM 只保證「至少一個維度非空」；選中的維度可能為空字串，fallback 到第一個有內容的
  const shownDim = deep
    ? (deep.dims[dim] ? dim : (DIM_TABS.find((t) => deep.dims[t.key]) || {}).key)
    : dim;

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="app">
      <div className="page-head">
        <div className="eyebrow">NATAL CHART</div>
        <h1>{profile.nickname}的命盤</h1>
        <p>
          {formatDots(profile.solarDate)} {timeSlotName(profile.timeIndex)}時 · {yinYang}
          {profile.genderRaw === '其他' ? '' : profile.gender} · {astrolabe.fiveElementsClass} · 命宮在
          {astrolabe.earthlyBranchOfSoulPalace}
        </p>
      </div>

      <div className="chips mb16">
        <button type="button" className="chip" onClick={() => scrollTo('sec-chart')}>本命</button>
        <button type="button" className="chip" onClick={() => scrollTo('sec-pattern')}>格局</button>
        <button type="button" className="chip" onClick={() => scrollTo('sec-fortune')}>運程</button>
      </div>

      <div className="chart mb16" id="sec-chart">
        {CHART_ORDER.map((branch) =>
          branch === 'C' ? (
            <div key="center" className="chart-center">
              <div className="uname">{profile.nickname.split('').join(' ')}</div>
              <div className="meta">
                陰曆 {lunarDateShort(astrolabe)} {astrolabe.time}
                <br />
                命宮：{astrolabe.earthlyBranchOfSoulPalace} · 身宮：{astrolabe.earthlyBranchOfBodyPalace}
                <br />
                五行局：{astrolabe.fiveElementsClass}
                <br />
                命主：{astrolabe.soul} · 身主：{astrolabe.body}
              </div>
            </div>
          ) : (
            <PalaceCell key={branch} palace={byBranch[branch]} />
          )
        )}
      </div>

      <div id="sec-pattern">
        <div className="card glow">
          <h3>✦ 一句話看懂你的格局</h3>
          <p className="lead">{describePattern(mingStars)}</p>
          {!deep && <p className="mt8">這只是命盤的千分之一。完整的十二宮解析、大限流年走向，都在深度報告裡。</p>}
        </div>

      {!deep && deepLoading && (
        <div className="card" style={{ borderStyle: 'dashed' }}>
          <h3>✨ 正在為你細讀整張命盤…</h3>
          <p className="lead" style={{ fontSize: 14, lineHeight: 1.8 }}>
            AI 正在逐一解析你的十二宮與目前大限，第一次生成約需 30–60 秒。先看看上面的格局，深度解讀馬上送到。
          </p>
        </div>
      )}

      {deep && (
        <>
          <div className="card glow">
            <h3>🔮 深度命盤解讀{deep.source === 'llm' ? ' · AI' : ''}</h3>
            <p className="lead" style={{ fontSize: 14, lineHeight: 1.8 }}>{deep.summary}</p>
          </div>

          <div className="card">
            <div className="chips mb8">
              {DIM_TABS.filter((t) => deep.dims[t.key]).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={`chip${shownDim === t.key ? ' on' : ''}`}
                  onClick={() => setDim(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="lead" style={{ fontSize: 14, lineHeight: 1.8 }}>{deep.dims[shownDim]}</p>
          </div>
        </>
      )}
      </div>

      <div id="sec-fortune">
      {deep && deep.decade && (
        <div className="card" style={{ borderColor: 'rgba(216,181,128,.35)', background: 'rgba(216,181,128,.07)' }}>
          <h3>🌊 這十年的主題</h3>
          <p className="lead" style={{ fontSize: 14, lineHeight: 1.8 }}>{deep.decade}</p>
        </div>
      )}

      {!horo && horoLoading && (
        <div className="card" style={{ borderStyle: 'dashed' }}>
          <p className="lead" style={{ fontSize: 13, margin: 0 }}>📅 今年與本月的運勢解讀生成中…</p>
        </div>
      )}

      {horo && (
        <div className="card">
          <h3>📅 今年與本月{horo.source === 'llm' ? ' · AI' : ''}</h3>
          {horo.yearly && (
            <div style={{ marginTop: 6 }}>
              <p className="lead" style={{ fontWeight: 700, marginBottom: 4 }}>今年｜{horo.yearly.theme}</p>
              <p className="lead" style={{ fontSize: 14, lineHeight: 1.8 }}>{horo.yearly.text}</p>
              {horo.yearly.focus && <p className="note mt8">✦ 值得留意：{horo.yearly.focus}</p>}
            </div>
          )}
          {horo.monthly && (
            <div style={{ marginTop: 14 }}>
              <p className="lead" style={{ fontWeight: 700, marginBottom: 4 }}>本月｜{horo.monthly.theme}</p>
              <p className="lead" style={{ fontSize: 14, lineHeight: 1.8 }}>{horo.monthly.text}</p>
              {horo.monthly.focus && <p className="note mt8">✦ 值得留意：{horo.monthly.focus}</p>}
            </div>
          )}
        </div>
      )}
      </div>

      <Link className="btn btn-gold" to="/today">下一步：看看今天的日報 →</Link>
      <Link className="btn btn-ghost mt8" to="/auspicious" style={{ fontSize: 13, padding: 12 }}>挑個好日子 📅</Link>
      <Link className="btn btn-ghost mt8" to="/reports" style={{ fontSize: 13, padding: 12 }}>查看問事報告</Link>
      <Link className="btn btn-ghost mt8" to="/ask" style={{ fontSize: 13, padding: 12 }}>針對命盤問一件事 ✦</Link>
      <p className="disclaimer">內容為自我探索與娛樂用途</p>

      <TabBar active="chart" />
    </div>
  );
}
