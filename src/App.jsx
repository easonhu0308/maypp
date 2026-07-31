import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getProfile } from './lib/storage.js';
import Onboarding from './screens/Onboarding.jsx';
import Chart from './screens/Chart.jsx';
import Today from './screens/Today.jsx';
import Checkin from './screens/Checkin.jsx';
import Reports from './screens/Reports.jsx';
import ReportDetail from './screens/ReportDetail.jsx';
import Ask from './screens/Ask.jsx';
import About from './screens/About.jsx';
import Timeline from './screens/Timeline.jsx';
import Privacy from './screens/Privacy.jsx';

// 沒有 profile 一律導回 onboarding
function RequireProfile({ children }) {
  return getProfile() ? children : <Navigate to="/onboarding" replace />;
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/today" replace />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/chart" element={<RequireProfile><Chart /></RequireProfile>} />
        <Route path="/today" element={<RequireProfile><Today /></RequireProfile>} />
        <Route path="/checkin" element={<RequireProfile><Checkin /></RequireProfile>} />
        <Route path="/reports" element={<RequireProfile><Reports /></RequireProfile>} />
        <Route path="/report-detail" element={<RequireProfile><ReportDetail /></RequireProfile>} />
        <Route path="/ask" element={<RequireProfile><Ask /></RequireProfile>} />
        <Route path="/about" element={<RequireProfile><About /></RequireProfile>} />
        <Route path="/subscribe" element={<Navigate to="/about" replace />} />
        <Route path="/timeline" element={<RequireProfile><Timeline /></RequireProfile>} />
        <Route path="/privacy" element={<RequireProfile><Privacy /></RequireProfile>} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Routes>
    </HashRouter>
  );
}
