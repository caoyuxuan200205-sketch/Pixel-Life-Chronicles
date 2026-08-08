import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, CircleAlert, Clock3,
  Eye, EyeOff, LockKeyhole, Mail, MapPin, Orbit, Sparkles,
} from 'lucide-react';
import { track } from '@vercel/analytics';
import { supabase } from '../lib/supabase';
import { login, register } from '../store';

type AuthView = 'welcome' | 'login' | 'register';

export const AuthPageV2 = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<AuthView>('welcome');
  const [registerStep, setRegisterStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [authUnavailable, setAuthUnavailable] = useState(false);
  const [pref, setPref] = useState<'tarot' | 'bazi'>('bazi');
  const [birthDate, setBirthDate] = useState('1998-06-15');
  const [birthTime, setBirthTime] = useState('12:00');
  const [birthPlace, setBirthPlace] = useState('杭州');

  const localModeAvailable = import.meta.env.DEV
    && ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const isLogin = view === 'login';

  const resetFeedback = () => {
    setError('');
    setNotice('');
    setAuthUnavailable(false);
  };

  const openAuth = (nextView: Exclude<AuthView, 'welcome'>) => {
    resetFeedback();
    setRegisterStep(1);
    setView(nextView);
  };

  const goBack = () => {
    resetFeedback();
    if (view === 'register' && registerStep === 2) {
      setRegisterStep(1);
    } else {
      setView('welcome');
    }
  };

  const validateAccount = () => {
    if (!email.trim() || !password) {
      setError('请输入邮箱和密码');
      return false;
    }
    if (password.length < 6) {
      setError('密码至少需要 6 位');
      return false;
    }
    return true;
  };

  const authenticateDirectly = async (trimmedEmail: string) => {
    const { data, error: directError } = isLogin
      ? await supabase.auth.signInWithPassword({ email: trimmedEmail, password })
      : await supabase.auth.signUp({ email: trimmedEmail, password });

    if (directError) {
      throw directError;
    }

    return data;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    resetFeedback();
    if (!validateAccount()) return;
    if (view === 'register' && registerStep === 1) {
      setRegisterStep(2);
      return;
    }

    setLoading(true);
    const trimmedEmail = email.trim();
    try {
      const configuredBackend = import.meta.env.VITE_BACKEND_URL?.trim();
      const baseUrl = configuredBackend || window.location.origin;
      const endpoint = isLogin ? '/api/auth/signin' : '/api/auth/signup';
      let response: Response | null = null;

      try {
        response = await fetch(baseUrl.replace(/\/$/, '') + endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmedEmail, password }),
        });
      } catch {
        response = null;
      }

      let result: Awaited<ReturnType<typeof authenticateDirectly>>;
      const unavailableStatuses = [404, 502, 503, 504];
      if (!response || unavailableStatuses.includes(response.status)) {
        result = await authenticateDirectly(trimmedEmail);
      } else {
        const responseResult = await response.json().catch(() => ({}));
        const responseMessage = responseResult.message || responseResult.error;
        if (!response.ok && response.status === 500 && !responseMessage) {
          result = await authenticateDirectly(trimmedEmail);
        } else if (!response.ok) {
          throw new Error(responseMessage || '认证服务返回错误 ' + response.status);
        } else {
          result = responseResult;
        }
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
        if (isLogin) {
          login(username, userId, userEmail);
        } else {
          register(
            username, userId, userEmail, pref,
            pref === 'bazi' ? { birthDate, birthTime, birthPlace } : undefined,
          );
        }
        navigate('/', { replace: true });
      } else if (!isLogin && result.user) {
        track('user_register_pending_confirmation', { email: trimmedEmail });
        setView('login');
        setRegisterStep(1);
        setNotice('确认邮件已发送，请完成邮箱验证后登录');
      } else {
        setError('暂未收到有效响应，请稍后重试');
      }
    } catch (caughtError: unknown) {
      const message = caughtError instanceof Error ? caughtError.message : '请求失败';
      const friendlyMessage = /already registered|already exists/i.test(message)
        ? '该邮箱已经注册，请直接登录'
        : /invalid login credentials/i.test(message)
          ? '邮箱或密码不正确'
          : /email.*rate limit|rate limit/i.test(message)
            ? '请求过于频繁，请稍后再试'
            : /password/i.test(message) && /least|short|weak/i.test(message)
              ? '密码强度不足，请使用至少 6 位字符'
              : message;

      if (/fetch failed|failed to fetch|network|timeout/i.test(message)) {
        setAuthUnavailable(true);
        setError('云端认证当前不可达，你可以先创建仅保存在此设备的本地账号');
      } else {
        setError(friendlyMessage || '操作失败，请重试');
      }
      track(isLogin ? 'user_login_failure' : 'user_register_failure', { reason: message });
    } finally {
      setLoading(false);
    }
  };

  const enterLocalMode = () => {
    const localEmail = email.trim() || 'local@freeweek.dev';
    const username = localEmail.split('@')[0] || 'local-user';
    const userId = 'local_' + encodeURIComponent(localEmail);
    if (isLogin) {
      login(username, userId, localEmail);
    } else {
      register(
        username, userId, localEmail, pref,
        pref === 'bazi' ? { birthDate, birthTime, birthPlace } : undefined,
      );
    }
    track('local_auth_fallback', { mode: isLogin ? 'login' : 'register' });
    navigate('/', { replace: true });
  };

  return (
    <main className="app-auth-page">
      <div className="app-auth-backdrop" aria-hidden="true" />
      <div className="app-auth-scrim" aria-hidden="true" />
      <AnimatePresence mode="wait" initial={false}>
        {view === 'welcome' ? (
          <motion.section
            key="welcome"
            className="app-auth-welcome"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.42 }}
          >
            <div className="app-auth-brand">
              <div className="app-auth-mark" aria-hidden="true"><Orbit /></div>
              <span>XUANTU AGENT</span>
            </div>
            <div className="app-auth-hero-copy">
              <p className="app-auth-eyebrow">首个玄学行程规划 AGENT</p>
              <h1>玄途 Agent</h1>
              <p>融合八字、塔罗与真实地点，把今天安排成一条合时、合地、合心意的路线。</p>
            </div>
            <div className="app-auth-welcome-actions">
              <button className="app-auth-primary" type="button" onClick={() => openAuth('register')}>
                开始规划 <ArrowRight aria-hidden="true" />
              </button>
              <button className="app-auth-secondary" type="button" onClick={() => openAuth('login')}>
                已有账号，直接登录
              </button>
              <p className="app-auth-terms">继续即表示你同意服务条款与隐私政策</p>
            </div>
          </motion.section>
        ) : (
          <motion.section
            key={view + '-' + registerStep}
            className="app-auth-sheet"
            initial={{ opacity: 0, y: 48 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: 'spring', stiffness: 280, damping: 30 }}
          >
            <div className="app-auth-sheet-handle" aria-hidden="true" />
            <header className="app-auth-sheet-header">
              <button className="app-auth-icon-button" type="button" onClick={goBack} aria-label="返回">
                <ArrowLeft aria-hidden="true" />
              </button>
              {view === 'register' && (
                <div className="app-auth-progress" aria-label={'注册步骤 ' + registerStep + '/2'}>
                  <span className="active" />
                  <span className={registerStep === 2 ? 'active' : ''} />
                </div>
              )}
            </header>

            <div className="app-auth-sheet-copy">
              <p>{isLogin ? '欢迎回来' : '创建账号 · ' + registerStep + '/2'}</p>
              <h2>{isLogin ? '继续你的玄学行程' : registerStep === 1 ? '先认识一下你' : '建立个人玄学档案'}</h2>
              <span>
                {isLogin
                  ? '登录后继续调整、导航并保存你的玄学行程'
                  : registerStep === 1
                    ? '使用邮箱创建账号，稍后可随时修改资料'
                    : '这些信息只用于生成更贴近你的玄学行程'}
              </span>
            </div>

            <form className="app-auth-form" onSubmit={handleSubmit}>
              {(isLogin || registerStep === 1) && (
                <>
                  <label className="app-auth-field">
                    <span>邮箱</span>
                    <div>
                      <Mail aria-hidden="true" />
                      <input type="email" autoComplete="email" placeholder="name@example.com"
                        value={email} onChange={(event) => setEmail(event.target.value)} />
                    </div>
                  </label>
                  <label className="app-auth-field">
                    <span>密码</span>
                    <div>
                      <LockKeyhole aria-hidden="true" />
                      <input type={showPassword ? 'text' : 'password'}
                        autoComplete={isLogin ? 'current-password' : 'new-password'}
                        placeholder="至少 6 位字符" value={password}
                        onChange={(event) => setPassword(event.target.value)} />
                      <button type="button" className="app-auth-password-toggle"
                        onClick={() => setShowPassword((current) => !current)}
                        aria-label={showPassword ? '隐藏密码' : '显示密码'}>
                        {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                      </button>
                    </div>
                  </label>
                </>
              )}

              {view === 'register' && registerStep === 2 && (
                <div className="app-auth-profile-fields">
                  <fieldset className="app-auth-preference">
                    <legend>探索偏好</legend>
                    <div>
                      <button type="button" className={pref === 'bazi' ? 'selected' : ''}
                        onClick={() => setPref('bazi')}>
                        <Orbit aria-hidden="true" />
                        <span><strong>东方八字</strong><small>时间与城市的节律</small></span>
                        {pref === 'bazi' && <CheckCircle2 aria-hidden="true" />}
                      </button>
                      <button type="button" className={pref === 'tarot' ? 'selected' : ''}
                        onClick={() => setPref('tarot')}>
                        <Sparkles aria-hidden="true" />
                        <span><strong>西方塔罗</strong><small>直觉与当下的启示</small></span>
                        {pref === 'tarot' && <CheckCircle2 aria-hidden="true" />}
                      </button>
                    </div>
                  </fieldset>

                  {pref === 'bazi' && (
                    <div className="app-auth-birth-grid">
                      <label className="app-auth-field full">
                        <span>出生日期</span>
                        <div><CalendarDays aria-hidden="true" />
                          <input value={birthDate} onChange={(event) => setBirthDate(event.target.value)} placeholder="1998-06-15" /></div>
                      </label>
                      <label className="app-auth-field">
                        <span>出生时间</span>
                        <div><Clock3 aria-hidden="true" />
                          <input value={birthTime} onChange={(event) => setBirthTime(event.target.value)} placeholder="12:00" /></div>
                      </label>
                      <label className="app-auth-field">
                        <span>出生地点</span>
                        <div><MapPin aria-hidden="true" />
                          <input value={birthPlace} onChange={(event) => setBirthPlace(event.target.value)} placeholder="城市" /></div>
                      </label>
                    </div>
                  )}
                </div>
              )}

              <AnimatePresence initial={false}>
                {(error || notice) && (
                  <motion.div className={'app-auth-feedback ' + (notice ? 'success' : '')}
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}>
                    {notice ? <CheckCircle2 aria-hidden="true" /> : <CircleAlert aria-hidden="true" />}
                    <span>{notice || error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {authUnavailable && localModeAvailable ? (
                <button className="app-auth-primary" type="button" onClick={enterLocalMode}>
                  {isLogin ? '使用本地身份进入' : '创建本地账号并进入'}
                  <ArrowRight aria-hidden="true" />
                </button>
              ) : (
                <button className="app-auth-primary" type="submit" disabled={loading}>
                  {loading ? '请稍候…' : isLogin ? '登录' : registerStep === 1 ? '继续' : '完成注册'}
                  {!loading && <ArrowRight aria-hidden="true" />}
                </button>
              )}
            </form>

            <footer className="app-auth-switch">
              <span>{isLogin ? '还没有账号？' : '已经有账号？'}</span>
              <button type="button" onClick={() => openAuth(isLogin ? 'register' : 'login')}>
                {isLogin ? '创建账号' : '直接登录'}
              </button>
            </footer>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
};
