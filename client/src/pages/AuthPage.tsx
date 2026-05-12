import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { login, register } from '../store';

export const AuthPage = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setError('请输入旅人代号');
      return;
    }

    if (isLogin) {
      const user = login(trimmedUsername);
      if (user) {
        navigate(-1);
      } else {
        setError('未找到该用户，请检查代号拼写或前往注册');
      }
    } else {
      const user = register(trimmedUsername);
      if (user) {
        navigate(-1);
      } else {
        setError('该代号已被占用，如果您已注册请直接登录');
      }
    }
  };

  return (
    <div className="page" style={{ alignItems: 'center', justifyContent: 'center', padding: '20px', position: 'relative' }}>
      
      {/* 返回按钮 */}
      <div style={{ position: 'absolute', top: '40px', left: '20px', zIndex: 10 }}>
        <button 
          onClick={() => navigate('/')}
          className="btn btn-ghost"
          style={{ padding: '8px' }}
        >
          <ChevronLeft size={20} />
        </button>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="pixel-panel"
        style={{
          width: '100%',
          maxWidth: '360px',
          padding: '40px 24px',
          position: 'relative',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ 
            fontSize: '48px',
            marginBottom: '16px',
            filter: 'drop-shadow(4px 4px 0px rgba(0,0,0,0.5))'
          }}>
            {isLogin ? '🔑' : '📜'}
          </div>
          <h2 className="font-mystic" style={{ fontSize: '1.8rem', color: 'var(--primary)', marginBottom: '8px' }}>
            {isLogin ? '唤醒旅程' : '缔结契约'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {isLogin ? '欢迎回到像素生活志' : '开始你的城市探索之旅'}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
              旅人代号 (USERNAME)
            </label>
            <input
              type="text"
              placeholder="输入你的代号..."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{
                width: '100%',
                background: '#1a1714',
                border: '2px solid var(--pixel-border-color)',
                padding: '14px 16px',
                color: '#fff',
                fontFamily: 'var(--font-main)',
                fontSize: '1rem',
                outline: 'none',
                boxShadow: 'inset 4px 4px 0px rgba(0,0,0,0.5)'
              }}
            />
          </div>

          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px', opacity: 0.5 }}>
              心流秘钥 (PASSWORD - 暂不需要)
            </label>
            <input
              type="password"
              placeholder="********"
              disabled
              style={{
                width: '100%',
                background: '#1a1714',
                border: '2px solid var(--pixel-border-color)',
                padding: '14px 16px',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-main)',
                fontSize: '1rem',
                outline: 'none',
                opacity: 0.3,
                cursor: 'not-allowed'
              }}
            />
          </div>

          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{ color: '#cc5555', fontSize: '0.8rem', textAlign: 'center' }}
              >
                ⚠ {error}
              </motion.div>
            )}
          </AnimatePresence>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', fontSize: '1.1rem' }}
          >
            {isLogin ? '进入世界' : '完成缔结'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '32px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '12px' }}>
            {isLogin ? '还没有代号？' : '已经有代号了？'}
          </p>
          <button 
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="btn btn-ghost"
            style={{ width: '100%', fontSize: '0.9rem' }}
          >
            {isLogin ? '前往注册' : '返回登录'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
