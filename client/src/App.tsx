import { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Map, Camera, Box } from 'lucide-react';
import './App.css';
import { HomePage } from './pages/HomePage';
import { MapPage } from './pages/MapPage';
import { CameraPage } from './pages/CameraPage';
import { ProfilePage } from './pages/ProfilePage';
import { AuthPage } from './pages/AuthPage';
import { User } from 'lucide-react';

// --- Components ---

import { getCurrentReading } from './store';

const NavBar = () => {
  const location = useLocation();
  const hasReading = !!getCurrentReading();
  
  const navItems = [
    { path: '/', label: '探索', icon: '🔭', visible: true },
    { path: '/map', label: '冒险', icon: '🗺️', visible: hasReading },
    { path: '/camera', label: '创作', icon: '🎨', visible: hasReading },
    { path: '/profile', label: '我的', icon: '🤠', visible: true },
  ];

  return (
    <div className="nav-bar pixel-panel" style={{ borderRadius: 0, boxShadow: 'none', borderBottom: 'none' }}>
      {navItems.filter(item => item.visible).map(({ path, label, icon: IconStr }) => (
        <Link 
          key={path} 
          to={path} 
          className={`nav-item ${location.pathname === path ? 'active' : ''}`}
        >
          <span style={{ fontSize: '24px', filter: location.pathname === path ? 'drop-shadow(2px 2px 0px rgba(226, 181, 83, 0.5))' : 'none', transform: location.pathname === path ? 'scale(1.1)' : 'scale(1)', transition: 'all 0.2s' }}>{IconStr}</span>
          <span style={{ marginTop: '2px', fontFamily: 'var(--font-main)' }}>{label}</span>
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
    </BrowserRouter>
  );
}

export default App;
