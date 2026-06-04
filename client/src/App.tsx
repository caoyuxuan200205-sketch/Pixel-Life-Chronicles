import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import './App.css';
import { HomePage } from './pages/HomePage';
import { MapPage } from './pages/MapPage';
import { CameraPage } from './pages/CameraPage';
import { ProfilePage } from './pages/ProfilePage';
import { AuthPage } from './pages/AuthPage';
import { CollectionPage } from './pages/CollectionPage';
import { PlanResultPage } from './pages/PlanResultPage';
import { AIPortalPage } from './pages/AIPortalPage';

// --- Injected Keyframe Styles ---
const StyleInject = () => (
  <style>{`
    @keyframes breath-glow {
      0%, 100% {
        box-shadow: 0 0 5px rgba(255, 208, 0, 0.15), 0 4px 0 rgba(0,0,0,0.4);
        transform: scale(1);
      }
      50% {
        box-shadow: 0 0 15px rgba(255, 208, 0, 0.45), 0 4px 0 rgba(0,0,0,0.4);
        transform: scale(1.05);
      }
    }
  `}</style>
);

// --- Components ---

import { getLatestJointPlan } from './store';

const NavBar = () => {
  const location = useLocation();
  const hasPlan = !!getLatestJointPlan();
  
  const navItems = [
    { path: '/', label: '探索', icon: '🔭', restricted: false },
    { path: '/map', label: '冒险', icon: '🗺️', restricted: !hasPlan },
    { path: '/ai', label: '星耀AI', icon: '🌟', restricted: false, isCentral: true },
    { path: '/plan', label: '命运', icon: '🔮', restricted: !hasPlan },
    { path: '/profile', label: '我的', icon: '🤠', restricted: false },
  ];

  const handleNavClick = (e: React.MouseEvent, item: typeof navItems[0]) => {
    if (item.restricted) {
      e.preventDefault();
      alert('【命格结界尚未凝聚】\n\n请先回到“探索”界面完成多人命盘编织，结界之力才会为你指引方向。');
      return;
    }
  };

  return (
    <div className="nav-bar pixel-panel" style={{ borderRadius: 0, boxShadow: 'none', borderBottom: 'none' }}>
      {navItems.map((item) => {
        if (item.isCentral) {
          const isActive = location.pathname === item.path;
          return (
            <Link 
              key={item.path} 
              to={item.path} 
              className={`nav-item central-nav-item ${isActive ? 'active' : ''}`}
              style={{
                position: 'relative',
                transform: 'translateY(-12px)',
                zIndex: 100,
                textDecoration: 'none'
              }}
            >
              <div 
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  background: isActive ? 'linear-gradient(135deg, #FFD000, #FFA500)' : '#231e1a',
                  border: isActive ? '3px solid #fff' : '3px solid var(--pixel-border-color)',
                  boxShadow: isActive ? '0 0 15px rgba(255, 208, 0, 0.6), 4px 4px 0 rgba(0,0,0,0.4)' : '0 4px 0 rgba(0,0,0,0.4)',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  transition: 'all 0.2s',
                  animation: isActive ? 'none' : 'breath-glow 2.5s infinite ease-in-out',
                }}
              >
                <span style={{ fontSize: '24px' }}>{item.icon}</span>
              </div>
              <span style={{ marginTop: '2px', fontFamily: 'var(--font-main)', fontSize: '0.65rem', color: isActive ? 'var(--primary)' : 'var(--text-secondary)' }}>
                {item.label}
              </span>
            </Link>
          );
        }

        const isActive = location.pathname === item.path || 
                        (item.path === '/profile' && location.pathname === '/collection');

        return (
          <Link 
            key={item.path} 
            to={item.path} 
            onClick={(e) => handleNavClick(e, item)}
            className={`nav-item ${isActive ? 'active' : ''}`}
            style={{ 
              opacity: item.restricted ? 0.4 : 1,
              filter: item.restricted ? 'grayscale(0.8)' : 'none',
            }}
          >
            <span style={{ 
              fontSize: '24px', 
              filter: isActive ? 'drop-shadow(2px 2px 0px rgba(226, 181, 83, 0.5))' : 'none', 
              transform: isActive ? 'scale(1.1)' : 'scale(1)', 
              transition: 'all 0.2s' 
            }}>
              {item.icon}
            </span>
            <span style={{ marginTop: '2px', fontFamily: 'var(--font-main)' }}>{item.label}</span>
            {item.restricted && (
               <div style={{ position: 'absolute', top: '8px', right: '12px', fontSize: '10px' }}>🔒</div>
            )}
          </Link>
        );
      })}
    </div>
  );
};

// --- Pages ---

const AppContent = () => {
  const location = useLocation();
  const hideNavBar = location.pathname === '/auth' || location.pathname === '/ai';
  
  return (
    <div className="app-shell">
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<HomePage />} />
          <Route path="/ai" element={<AIPortalPage />} />
          <Route path="/plan" element={<PlanResultPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/camera" element={<CameraPage />} />
          <Route path="/collection" element={<CollectionPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/auth" element={<AuthPage />} />
        </Routes>
      </AnimatePresence>
      {!hideNavBar && <NavBar />}
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <StyleInject />
      <AppContent />
      <Analytics />
      <SpeedInsights />
    </BrowserRouter>
  );
}

export default App;
