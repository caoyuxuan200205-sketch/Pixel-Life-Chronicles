import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { House, Route as RouteIcon, Sparkles, UserRound } from 'lucide-react';
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import './App.css';
import { HomePage } from './pages/HomePage';
import { MapPage } from './pages/MapPage';
import { CameraPage } from './pages/CameraPage';
import { ProfilePage } from './pages/ProfilePage';
import { AuthPageV2 } from './pages/AuthPageV2';
import { CollectionPage } from './pages/CollectionPage';
import { PlanResultPage } from './pages/PlanResultPage';
import { AIPortalPage } from './pages/AIPortalPage';

// --- Components ---

import { getCurrentUser, getLatestJointPlan } from './store';


const NavBar = () => {
  const location = useLocation();
  const hasPlan = !!getLatestJointPlan();

  const navItems = [
    { path: '/', label: '首页', icon: House, restricted: false },
    { path: '/planner', label: '规划', icon: Sparkles, restricted: false },
    { path: '/plan', label: '行程', icon: RouteIcon, restricted: !hasPlan },
    { path: '/profile', label: '我的', icon: UserRound, restricted: false },
  ];

  const handleNavClick = (event: React.MouseEvent, item: typeof navItems[0]) => {
    if (!item.restricted) return;
    event.preventDefault();
    alert('还没有可查看的行程。\n\n请先在规划页告诉玄途你的出行愿望。');
  };

  return (
    <nav className="nav-bar xuantu-nav" aria-label="主要导航">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path ||
          (item.path === '/' && location.pathname === '/ai') ||
          (item.path === '/profile' && location.pathname === '/collection');

        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={(event) => handleNavClick(event, item)}
            className={`nav-item ${isActive ? 'active' : ''}`}
            style={{
              opacity: item.restricted ? 0.42 : 1,
              filter: item.restricted ? 'grayscale(0.8)' : 'none',
            }}
          >
            <span aria-hidden="true"><Icon /></span>
            <span>{item.label}</span>
            {item.restricted && <span className="nav-restricted-dot" aria-hidden="true" />}
          </Link>
        );
      })}
    </nav>
  );
};
// --- Pages ---

const AppContent = () => {
  const location = useLocation();
  const hideNavBar = location.pathname === '/auth';
  const isAuthenticated = !!getCurrentUser();
  
  return (
    <div className="app-shell">
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={isAuthenticated ? <HomePage mode="landing" /> : <Navigate to="/auth" replace />} />
          <Route path="/planner" element={isAuthenticated ? <HomePage mode="planner" /> : <Navigate to="/auth" replace />} />
          <Route path="/ai" element={isAuthenticated ? <AIPortalPage /> : <Navigate to="/auth" replace />} />
          <Route path="/plan" element={isAuthenticated ? <PlanResultPage /> : <Navigate to="/auth" replace />} />
          <Route path="/map" element={isAuthenticated ? <MapPage /> : <Navigate to="/auth" replace />} />
          <Route path="/camera" element={isAuthenticated ? <CameraPage /> : <Navigate to="/auth" replace />} />
          <Route path="/collection" element={isAuthenticated ? <CollectionPage /> : <Navigate to="/auth" replace />} />
          <Route path="/profile" element={isAuthenticated ? <ProfilePage /> : <Navigate to="/auth" replace />} />
          <Route path="/auth" element={<AuthPageV2 />} />
        </Routes>
      </AnimatePresence>
      {isAuthenticated && !hideNavBar && <NavBar />}
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AppContent />
      <Analytics />
      <SpeedInsights />
    </BrowserRouter>
  );
}

export default App;
