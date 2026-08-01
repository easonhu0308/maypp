import React from 'react';
import { Link } from 'react-router-dom';

const TABS = [
  { to: '/today', icon: '☀', label: '今日', key: 'today' },
  { to: '/chart', icon: '✦', label: '運勢', key: 'chart' },
  { to: '/ask', icon: '❖', label: '問事', key: 'ask' },
  { to: '/timeline', icon: '🌙', label: '時間軸', key: 'timeline' },
  { to: '/privacy', icon: '☺', label: '我的', key: 'privacy' },
];

export default function TabBar({ active }) {
  return (
    <nav className="tabbar">
      {TABS.map((t) => (
        <Link key={t.key} to={t.to} className={active === t.key ? 'on' : ''}>
          <span className="ic">{t.icon}</span>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
