import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Mail, Lock } from 'lucide-react';
import { track } from "@vercel/analytics";
import { supabase } from '../lib/supabase';
import { login, register } from '../store';

export const AuthPage = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('请输入邮箱和秘钥');
      setLoading(false);
      return;
    }

    try {
      const endpoint = isLogin ? '/api/auth/signin' : '/api/auth/signup';
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || '认证失败');
      }

      if (result.session) {
        // 同步 Session 到本地 Supabase 客户端，以便后续调用
        await supabase.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token,
        });

        track(isLogin ? 'user_login_success' : 'user_register_success', { email: trimmedEmail });
        login(trimmedEmail.split('@')[0], password); 
        
        if (!isLogin) {
          alert('契约已发出！请检查邮箱完成验证（如果开启了邮箱验证）。');
        }
        navigate(-1);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err.message || '操作失败，请重试');
      track(isLogin ? 'user_login_failure' : 'user_register_failure', { reason: err.message });
    } finally {
      setLoading(false);
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
              旅人邮箱 (EMAIL)
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)', opacity: 0.6 }} />
              <input
                type="email"
                placeholder="yourname@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  background: '#1a1714',
                  border: '2px solid var(--pixel-border-color)',
                  padding: '14px 16px 14px 44px',
                  color: '#fff',
                  fontFamily: 'var(--font-main)',
                  fontSize: '1rem',
                  outline: 'none',
                  boxShadow: 'inset 4px 4px 0px rgba(0,0,0,0.5)'
                }}
              />
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
              心流秘钥 (PASSWORD)
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)', opacity: 0.6 }} />
              <input
                type="password"
                placeholder="请输入 6 位以上秘钥"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  background: '#1a1714',
                  border: '2px solid var(--pixel-border-color)',
                  padding: '14px 16px 14px 44px',
                  color: '#fff',
                  fontFamily: 'var(--font-main)',
                  fontSize: '1rem',
                  outline: 'none',
                  boxShadow: 'inset 4px 4px 0px rgba(0,0,0,0.5)'
                }}
              />
            </div>
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
            disabled={loading}
            style={{ width: '100%', fontSize: '1.1rem', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? '仪式进行中...' : (isLogin ? '进入世界' : '完成缔结')}
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
