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

// --- Components ---

import { getCurrentReading } from './store';

const NavBar = () => {
  const location = useLocation();
  const hasReading = !!getCurrentReading();
  
  const navItems = [
    { path: '/', label: '探索', icon: '🔭', restricted: false },
    { path: '/map', label: '冒险', icon: '🗺️', restricted: !hasReading },
    { path: '/camera', label: '创作', icon: '🎨', restricted: !hasReading },
    { path: '/profile', label: '我的', icon: '🤠', restricted: false },
  ];

  const handleNavClick = (e: React.MouseEvent, item: typeof navItems[0]) => {
    if (item.restricted) {
      e.preventDefault();
      alert('【命运之门尚未开启】\n\n请先回到“探索”界面完成今日占卜，契约之力才会为你指引方向。');
      return;
    }
  };

  return (
    <div className="nav-bar pixel-panel" style={{ borderRadius: 0, boxShadow: 'none', borderBottom: 'none' }}>
      {navItems.map((item) => (
        <Link 
          key={item.path} 
          to={item.path} 
          onClick={(e) => handleNavClick(e, item)}
          className={`nav-item ${location.pathname === item.path || (item.path === '/profile' && location.pathname === '/collection') ? 'active' : ''}`}
          style={{ 
            opacity: item.restricted ? 0.4 : 1,
            filter: item.restricted ? 'grayscale(0.8)' : 'none',
          }}
        >
          <span style={{ 
            fontSize: '24px', 
            filter: (location.pathname === item.path || (item.path === '/profile' && location.pathname === '/collection')) ? 'drop-shadow(2px 2px 0px rgba(226, 181, 83, 0.5))' : 'none', 
            transform: (location.pathname === item.path || (item.path === '/profile' && location.pathname === '/collection')) ? 'scale(1.1)' : 'scale(1)', 
            transition: 'all 0.2s' 
          }}>
            {item.icon}
          </span>
          <span style={{ marginTop: '2px', fontFamily: 'var(--font-main)' }}>{item.label}</span>
          {item.restricted && (
             <div style={{ position: 'absolute', top: '8px', right: '12px', fontSize: '10px' }}>🔒</div>
          )}
        </Link>
      ))}
    </div>
  );
};

// --- Pages ---





const AppContent = () => {
  const location = useLocation();
  const hideNavBar = location.pathname === '/auth';
  
  return (
    <div className="app-shell">
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<HomePage />} />
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
      <AppContent />
      <Analytics />
      <SpeedInsights />
    </BrowserRouter>
  );
}

export default App;
