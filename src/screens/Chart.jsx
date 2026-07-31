import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getProfile } from '../lib/storage.js';
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

export default function Chart() {
  const profile = getProfile();
  const astrolabe = useMemo(() => buildAstrolabe(profile), [profile]);
  const byBranch = useMemo(() => {
    const map = {};
    for (const p of astrolabe.palaces) map[p.earthlyBranch] = p;
    return map;
  }, [astrolabe]);
  const mingStars = getMingStarNames(astrolabe);
  const yinYang = getYinYang(astrolabe);

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

      <div className="chart mb16">
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

      <div className="card glow">
        <h3>✦ 一句話看懂你的格局</h3>
        <p className="lead">{describePattern(mingStars)}</p>
        <p className="mt8">這只是命盤的千分之一。完整的十二宮解析、大限流年走向，都在深度報告裡。</p>
      </div>

      <Link className="btn btn-gold" to="/today">下一步：看看今天的日報 →</Link>
      <Link className="btn btn-ghost mt8" to="/reports" style={{ fontSize: 13, padding: 12 }}>查看問事報告</Link>
      <Link className="btn btn-ghost mt8" to="/ask" style={{ fontSize: 13, padding: 12 }}>針對命盤問一件事 ✦</Link>
      <p className="disclaimer">內容為自我探索與娛樂用途</p>

      <TabBar active="chart" />
    </div>
  );
}
