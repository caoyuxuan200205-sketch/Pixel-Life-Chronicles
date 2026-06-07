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

  // 新建注册用天命偏好与生日状态
  const [pref, setPref] = useState<'tarot' | 'bazi'>('bazi');
  const [birthDate, setBirthDate] = useState('1998-06-15');
  const [birthTime, setBirthTime] = useState('12:00');
  const [birthPlace, setBirthPlace] = useState('杭州');

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
      const baseUrl = import.meta.env.VITE_BACKEND_URL || window.location.origin;
      const endpoint = isLogin ? '/api/auth/signin' : '/api/auth/signup';
      const fullUrl = `${baseUrl.replace(/\/$/, '')}${endpoint}`;
      
      console.log('Attempting auth request to:', fullUrl);

      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || `服务器返回错误: ${response.status}`);
      }

      if (result.session) {
        await supabase.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token,
        });

        const userEmail = result.session.user.email || trimmedEmail;
        const username = userEmail.split('@')[0];
        const userId = result.session.user.id;

        track(isLogin ? 'user_login_success' : 'user_register_success', { email: userEmail });
        
        // 更新全局 Store 状态 (保存注册时的天命偏好与生辰八字)
        if (isLogin) {
          login(username, userId, userEmail); 
        } else {
          register(username, userId, userEmail, pref, pref === 'bazi' ? { birthDate, birthTime, birthPlace } : undefined);
        }
        
        if (!isLogin) {
          alert('契约达成！欢迎来到像素生活志。');
        }
        navigate('/', { replace: true });
      } else if (!isLogin && result.user) {
        // 注册成功但需要邮箱确认 (session 为 null)
        track('user_register_pending_confirmation', { email: trimmedEmail });
        alert('📜 契约已缔结！请前往你的邮箱点击确认链接，完成最终仪式后即可登录。');
        setIsLogin(true);
        setError('');
      } else if (!isLogin) {
        setError('注册请求已发送，但未收到有效响应，请稍后再试。');
      }
    } catch (err: any) {
      console.error('Auth full error:', err);
      alert(`认证异常: ${err.message}`);
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
          maxWidth: 'clamp(320px, 90vw, 420px)',
          padding: 'clamp(24px, 5vw, 40px) clamp(16px, 4vw, 24px)',
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
                  boxShadow: 'inset 4px 4px 0px rgba(0,0,0,0.5)',
                  boxSizing: 'border-box'
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
                  boxShadow: 'inset 4px 4px 0px rgba(0,0,0,0.5)',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* 注册专属：天命偏好与生日八字档案设置 */}
          {!isLogin && (
            <div className="pixel-panel" style={{ padding: '16px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--pixel-border-color)', display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0, boxSizing: 'border-box', width: '100%' }}>
              <h4 className="font-mystic" style={{ color: 'var(--primary)', fontSize: '0.85rem', marginBottom: '4px', textAlign: 'center' }}>
                ☯️ 天命档案初始化
              </h4>

              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '6px' }}>占卜仪式偏好</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setPref('bazi')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      fontSize: '0.75rem',
                      background: pref === 'bazi' ? 'var(--primary-dim)' : 'transparent',
                      color: pref === 'bazi' ? 'var(--primary)' : 'var(--text-muted)',
                      border: `1px solid ${pref === 'bazi' ? 'var(--primary)' : 'var(--pixel-border-color)'}`,
                      boxShadow: 'none',
                      height: 'auto'
                    }}
                  >
                    ☯️ 东方八字
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setPref('tarot')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      fontSize: '0.75rem',
                      background: pref === 'tarot' ? 'var(--primary-dim)' : 'transparent',
                      color: pref === 'tarot' ? 'var(--primary)' : 'var(--text-muted)',
                      border: `1px solid ${pref === 'tarot' ? 'var(--primary)' : 'var(--pixel-border-color)'}`,
                      boxShadow: 'none',
                      height: 'auto'
                    }}
                  >
                    🃏 西方塔罗
                  </button>
                </div>
              </div>

              {pref === 'bazi' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0, width: '100%' }}>
                  <div style={{ minWidth: 0, width: '100%' }}>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>出生公历日期</label>
                    <input
                      type="text"
                      placeholder="1998-06-15"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="bazi-input"
                    />
                  </div>

                  <div className="bazi-fields-row">
                    <div className="bazi-time-col">
                      <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>出生时辰</label>
                      <input
                        type="text"
                        placeholder="12:00"
                        value={birthTime}
                        onChange={(e) => setBirthTime(e.target.value)}
                        className="bazi-input"
                      />
                    </div>
                    <div className="bazi-place-col">
                      <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>出生地点</label>
                      <input
                        type="text"
                        placeholder="省/市"
                        value={birthPlace}
                        onChange={(e) => setBirthPlace(e.target.value)}
                        className="bazi-input"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

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
