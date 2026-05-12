import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, MapPin, ChevronRight, Wand2, Compass, User as UserIcon, Calendar, Clock4, Sparkles } from 'lucide-react';
import AMapLoader from '@amap/amap-jsapi-loader';
import { useNavigate } from 'react-router-dom';
import {
  TAROT_CARDS,
  POI_DATABASE,
  generateReading,
  saveReading,
  getCurrentReading,
  canDraw,
  resetForDemo,
  getCurrentUser,
  type POIData,
  type ReadingResult,
} from '../store';
import { performAIReading, MOOD_TAGS, type MoodTag, type BaziInfo } from '../services/ai';

const SPREAD_COUNT = 5;

const DIVINATION_METHODS = [
  { id: 'tarot', label: '西方塔罗', icon: '🃏', desc: '解读命运之牌的隐秘启示' },
  { id: 'bazi', label: '东方八字', icon: '☯️', desc: '依据天干地支探寻命定之所' },
  { id: 'star', label: '星盘引航', icon: '🌌', desc: '根据星轨运转锚定幸运坐标' },
  { id: 'mirror', label: '灵光古镜', icon: '🔮', desc: '直觉投射映照出内心归宿' },
];

// ==========================================
// 粒子背景
// ==========================================
const FloatingParticles = () => {
  const particles = Array.from({ length: 18 }, (_, i) => ({
    id: i, x: Math.random() * 100, y: Math.random() * 100, size: Math.random() * 3 + 1, delay: Math.random() * 5, duration: Math.random() * 4 + 4,
  }));
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {particles.map((p) => (
        <motion.div key={p.id} style={{ position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size, borderRadius: '50%', background: p.id % 2 === 0 ? 'var(--primary)' : 'rgba(255, 255, 255, 0.5)', opacity: 0.4 }} animate={{ y: [0, -30, 0], opacity: [0.2, 0.7, 0.2], scale: [1, 1.4, 1] }} transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }} />
      ))}
    </div>
  );
};

// ==========================================
// 魔法阵背景装饰 (加强版)
// ==========================================
const MagicCircle = () => (
  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '560px', height: '560px', pointerEvents: 'none', zIndex: 1, opacity: 0.3 }}>
    <motion.div 
      animate={{ rotate: 360 }} 
      transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
      style={{ width: '100%', height: '100%', position: 'relative' }}
    >
      {/* 外圈 */}
      <div style={{ position: 'absolute', inset: 0, border: '3px solid var(--primary)', borderRadius: '50%', boxShadow: '0 0 15px var(--primary)' }} />
      <div style={{ position: 'absolute', inset: '12px', border: '1px dashed var(--primary)', borderRadius: '50%' }} />
      
      {/* 符文层 */}
      <div style={{ position: 'absolute', inset: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {Array.from({ length: 18 }).map((_, i) => (
          <div key={i} style={{ position: 'absolute', height: '100%', transform: `rotate(${i * 20}deg)`, fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 'bold', paddingTop: '10px', textShadow: '0 0 5px var(--primary)' }}>
            {['ᛋ', 'ᚦ', 'ᚠ', 'ᚢ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᚹ', 'ᚺ', 'ᚻ', 'ᛁ', 'ᛃ', 'ᛇ', 'ᛈ', 'ᛉ', 'ᛊ', 'ᛋ', 'ᛏ'][i]}
          </div>
        ))}
      </div>

      {/* 内圈几何 */}
      <div style={{ position: 'absolute', inset: '80px', border: '1px solid var(--primary)', transform: 'rotate(22.5deg)' }} />
      <div style={{ position: 'absolute', inset: '80px', border: '1px solid var(--primary)', transform: 'rotate(-22.5deg)' }} />
      <div style={{ position: 'absolute', inset: '80px', border: '2px solid var(--primary)', transform: 'rotate(67.5deg)' }} />
      <div style={{ position: 'absolute', inset: '80px', border: '2px solid var(--primary)', transform: 'rotate(-67.5deg)' }} />
      <div style={{ position: 'absolute', inset: '110px', border: '2px double var(--primary)', borderRadius: '50%', boxShadow: 'inset 0 0 20px var(--primary)' }} />
    </motion.div>
  </div>
);

// ==========================================
// 主页组件
// ==========================================
export const HomePage = () => {
  const navigate = useNavigate();

  // Phases: intro -> method -> bazi_input -> mood -> idle -> selecting -> revealing -> done
  // Phases: intro -> method -> bazi_input -> mood -> idle -> selecting -> flipping -> revealed -> analyzing -> done
  const [phase, setPhase] = useState<'intro' | 'method' | 'bazi_input' | 'mood' | 'idle' | 'selecting' | 'flipping' | 'revealed' | 'analyzing' | 'done'>('intro');
  const [divinationMethod, setDivinationMethod] = useState<string | null>(null);
  const [baziInfo, setBaziInfo] = useState<BaziInfo>({ name: '', gender: 'female', birthDate: '2000-01-01', birthTime: '12:00' });
  const [selectedMood, setSelectedMood] = useState<MoodTag | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [result, setResult] = useState<ReadingResult | null>(null);
  const [canDrawCard, setCanDrawCard] = useState(true);
  const [textRevealed, setTextRevealed] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState<string>('');
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    let timer: any;
    if (phase === 'analyzing' || phase === 'selecting') {
      const start = Date.now();
      timer = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - start) / 1000));
      }, 1000);
    } else if (phase === 'idle' || phase === 'revealed') {
      setElapsedTime(0);
      clearInterval(timer);
    }
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    const existing = getCurrentReading();
    if (existing) {
      setResult(existing);
      setPhase('done');
      setSelectedIndex(2);
      setTextRevealed(true);
    } else {
      setPhase('intro');
    }
    // Demo 模式下始终允许观测
    setCanDrawCard(true);
  }, []);

  const handleSelectMethod = (methodId: string) => {
    setDivinationMethod(methodId);
    if (methodId === 'bazi') {
      setPhase('bazi_input');
    } else {
      setPhase('mood');
    }
  };

  const handleBaziSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPhase('mood');
  };

  const handleSelectMood = (mood: MoodTag | null) => {
    setSelectedMood(mood);
    setPhase('idle');
  };

  const handleSelectCard = useCallback(async (index: number) => {
    if (phase !== 'idle') return;

    if (!getCurrentUser()) {
      alert('请先缔结契约（登录）以开启命运之旅。');
      navigate('/auth');
      return;
    }

    setSelectedIndex(index);
    setPhase('selecting');

    // 1. 立即确定抽中的牌
    const drawnCard = divinationMethod === 'bazi' ? { id: -1, name: '八字格局', emoji: '☯️', meaning: '' } : TAROT_CARDS[Math.floor(Math.random() * TAROT_CARDS.length)];
    
    // 立即更新结果状态以展示牌面
    setResult({
      card: drawnCard,
      poi: POI_DATABASE[0],
      reading: '',
      drawnAt: new Date().toISOString()
    });

    // 翻牌动画
    setTimeout(() => {
      setPhase('revealed');
    }, 1000);
  }, [phase, divinationMethod, navigate]);

  const handleStartAI = useCallback(async () => {
    if (phase !== 'revealed' || !result) return;
    
    setPhase('analyzing');
    try {
      setLoadingMsg('定位当前坐标...');
      (window as any)._AMapSecurityConfig = { 
        securityJsCode: import.meta.env.VITE_AMAP_SECURITY_JS_CODE 
      };
      const AMap = await AMapLoader.load({ 
        key: import.meta.env.VITE_AMAP_KEY, 
        version: '2.0', 
        plugins: ['AMap.Geolocation', 'AMap.PlaceSearch'] 
      });

      const geolocation = new AMap.Geolocation({ enableHighAccuracy: true, timeout: 5000 });
      let center: [number, number] = [116.397, 39.900];
      try {
        const pos = await new Promise<any>((resolve, reject) => {
          geolocation.getCurrentPosition((status: string, res: any) => {
            if (status === 'complete') resolve(res); else reject(res);
          });
        });
        center = [pos.position.lng, pos.position.lat];
      } catch (e) { console.warn(e); }

      setLoadingMsg('寻找命定锚点...');
      const placeSearch = new AMap.PlaceSearch({ type: '咖啡馆|公园|美术馆|书店|唱片店|手作|风景名胜', pageSize: 20 });
      let realPois: POIData[] = [];
      try {
        const searchRes = await new Promise<any>((resolve, reject) => {
          placeSearch.searchNearBy('', center, 5000, (status: string, res: any) => {
            if (status === 'complete') resolve(res); else reject(res);
          });
        });
        if (searchRes.poiList?.pois) {
          realPois = searchRes.poiList.pois.map((p: any) => ({ id: p.id, name: p.name, type: p.type || '未知场所', rating: 4.5 + Math.random() * 0.5, tags: [p.type], distance: p.distance || 1000, direction: '附近', location: [p.location.lng, p.location.lat], address: p.address }));
        }
      } catch (e) { console.warn(e); }

      const { aiResult, card, poi } = await performAIReading(
        selectedMood, 
        realPois, 
        setLoadingMsg, 
        divinationMethod || 'tarot', 
        baziInfo,
        (partialText) => {
          setResult(prev => prev ? { ...prev, reading: partialText } : null);
          setTextRevealed(true);
        },
        result.card
      );
      
      const newReading: ReadingResult = { card, poi, reading: aiResult.reading, drawnAt: new Date().toISOString() };
      saveReading(newReading);
      setResult(newReading);
      setPhase('done');
      setTextRevealed(true);
      setCanDrawCard(canDraw());
    } catch (e) {
      console.error(e);
      const randomPOI = POI_DATABASE[Math.floor(Math.random() * POI_DATABASE.length)];
      const res: ReadingResult = { card: result.card, poi: randomPOI, reading: generateReading(randomPOI, result.card), drawnAt: new Date().toISOString() };
      saveReading(res);
      setResult(res);
      setPhase('done');
      setTextRevealed(true);
    }
  }, [phase, result, selectedMood, divinationMethod, baziInfo]);



  const handleReset = () => {
    resetForDemo();
    setPhase('intro');
    setSelectedIndex(null);
    setResult(null);
    setTextRevealed(false);
    setCanDrawCard(true);
    setSelectedMood(null);
    setDivinationMethod(null);
  };

  const isDone = phase === 'done';

  return (
    <div className="page" style={{ alignItems: 'center', padding: '40px 0 var(--nav-height) 0', position: 'relative', overflow: 'hidden' }}>
      {/* 游戏风格背景装饰 */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 30%, rgba(255, 208, 0, 0.05) 0%, transparent 70%)', zIndex: 0 }} />
      <div className="crt-overlay" style={{ pointerEvents: 'none', zIndex: 100 }} />
      <FloatingParticles />

      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', zIndex: 2, marginBottom: '20px' }}>
        <h1 className="font-mystic text-gradient-full" style={{ fontSize: '1.8rem', fontWeight: 900, textShadow: '0 0 15px rgba(255, 208, 0, 0.3)' }}>像素生活志</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.55rem', letterSpacing: '4px', marginTop: '4px', opacity: 0.8 }}>别做攻略了，命运自有安排</p>
      </motion.div>

      <AnimatePresence mode="wait">
        {/* Intro - 游戏主界面风格 */}
        {phase === 'intro' && (
          <motion.div 
            key="intro" 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0, scale: 1.1 }} 
            style={{ 
              zIndex: 10, 
              flex: 1, 
              width: '100%', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              paddingTop: '100px' 
            }}
          >
            {/* 魔法阵作为核心视觉中心 */}
            <div style={{ position: 'absolute', top: '45%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1 }}>
              <MagicCircle />
            </div>
            
            <motion.div 
              initial={{ scale: 0.8, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              transition={{ delay: 0.3, type: 'spring', damping: 15 }}
              className="pixel-panel" 
              style={{ 
                padding: '16px 40px', 
                background: 'rgba(20, 18, 16, 0.8)', 
                backdropFilter: 'blur(4px)',
                border: '1px solid var(--primary)',
                boxShadow: '0 0 30px rgba(255, 208, 0, 0.15)',
                position: 'relative',
                zIndex: 10,
                marginTop: '60px'
              }}
            >
              <div style={{ position: 'absolute', inset: '2px', border: '1px solid rgba(255, 208, 0, 0.1)', pointerEvents: 'none' }} />
              <motion.div 
                animate={{ opacity: [0.8, 1, 0.8] }} 
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} 
                style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--primary)', letterSpacing: '4px', textShadow: '0 0 10px var(--primary)' }}
              >
                ✦ 探索你的命定周末 ✦
              </motion.div>
            </motion.div>

            {/* 开始按钮固定在下方 */}
            <div style={{ position: 'absolute', bottom: '100px', textAlign: 'center', width: '100%', zIndex: 20 }}>
              <motion.div
                animate={{ opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{ color: 'var(--text-muted)', fontSize: '0.65rem', marginBottom: '24px', letterSpacing: '4px', fontWeight: 'bold' }}
              >
                - CLICK TO ENTER DESTINY -
              </motion.div>
              
              <motion.button 
                whileHover={{ scale: 1.1, boxShadow: '0 0 30px var(--primary)', filter: 'brightness(1.2)' }} 
                whileTap={{ scale: 0.9 }} 
                onClick={() => setPhase('method')} 
                style={{ 
                  background: 'var(--primary)', 
                  border: '2px solid #fff', 
                  color: '#000', 
                  padding: '20px 90px', 
                  fontSize: '1.3rem', 
                  fontWeight: 900, 
                  cursor: 'pointer', 
                  clipPath: 'polygon(10% 0, 90% 0, 100% 50%, 90% 100%, 10% 100%, 0 50%)',
                  boxShadow: '0 0 20px rgba(255, 208, 0, 0.6)',
                  textTransform: 'uppercase',
                  letterSpacing: '2px'
                }}
              >
                开启仪式
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ... (method phase) */}

        {/* Method */}
        {phase === 'method' && (
          <motion.div key="method" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} style={{ zIndex: 10, width: '100%', maxWidth: '340px', textAlign: 'center' }}>
            <h3 className="font-mystic" style={{ color: 'var(--primary)', marginBottom: '24px' }}>✦ 请选择启示形式 ✦</h3>
            <div style={{ display: 'grid', gap: '16px' }}>
              {DIVINATION_METHODS.map((m) => (
                <motion.button key={m.id} whileHover={{ x: 5, background: 'rgba(255,255,255,0.05)' }} onClick={() => handleSelectMethod(m.id)} className="pixel-panel" style={{ padding: '16px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-surface)', cursor: 'pointer' }}>
                  <span style={{ fontSize: '2rem' }}>{m.icon}</span>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff' }}>{m.label}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>{m.desc}</div>
                  </div>
                  <ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.3 }} />
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Bazi Input */}
        {phase === 'bazi_input' && (
          <motion.div key="bazi_input" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} style={{ zIndex: 10, width: '100%', maxWidth: '340px', padding: '0 20px' }}>
            <div className="pixel-panel" style={{ padding: '24px', background: 'var(--bg-surface)' }}>
              <h3 className="font-mystic" style={{ color: 'var(--primary)', marginBottom: '24px', textAlign: 'center' }}>☯️ 填写生辰信息 ☯️</h3>
              <form onSubmit={handleBaziSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {(() => {
                  const commonInputStyle: React.CSSProperties = {
                    width: '100%',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--pixel-border-color)',
                    padding: '12px',
                    color: '#fff',
                    fontSize: '0.9rem',
                    borderRadius: 0,
                    outline: 'none',
                    fontFamily: 'inherit',
                    appearance: 'none',
                    WebkitAppearance: 'none'
                  };
                  return (
                    <>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}><UserIcon size={14} /> 姓名/代号</label>
                        <input type="text" required placeholder="输入你的名号" value={baziInfo.name} onChange={e => setBaziInfo({ ...baziInfo, name: e.target.value })} style={commonInputStyle} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>性别</label>
                        <select value={baziInfo.gender} onChange={e => setBaziInfo({ ...baziInfo, gender: e.target.value as any })} style={commonInputStyle}>
                          <option value="male">乾 (男)</option>
                          <option value="female">坤 (女)</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}><Calendar size={14} /> 出生日期 (公历)</label>
                        <input type="date" required value={baziInfo.birthDate} onChange={e => setBaziInfo({ ...baziInfo, birthDate: e.target.value })} style={commonInputStyle} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}><Clock4 size={14} /> 出生时辰</label>
                        <input type="time" required value={baziInfo.birthTime} onChange={e => setBaziInfo({ ...baziInfo, birthTime: e.target.value })} style={commonInputStyle} />
                      </div>
                      <button type="submit" className="btn btn-primary" style={{ marginTop: '12px', padding: '12px' }}>定格时空</button>
                      <button type="button" onClick={() => setPhase('method')} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '4px', cursor: 'pointer' }}>返回选择其他形式</button>
                    </>
                  );
                })()}
              </form>
            </div>
          </motion.div>
        )}

        {/* Mood */}
        {phase === 'mood' && (
          <motion.div key="mood" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} style={{ zIndex: 10, width: '100%', maxWidth: '360px', padding: '0 20px', textAlign: 'center' }}>
            <h3 className="font-mystic" style={{ color: 'var(--primary)', marginBottom: '24px' }}>✦ 此时此刻，你的能量状态？ ✦</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {MOOD_TAGS.map((mood) => (
                <button key={mood.id} className="pixel-panel" onClick={() => handleSelectMood(mood)} style={{ padding: '16px', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer' }}><span style={{ fontSize: '1.5rem' }}>{mood.emoji}</span><span className="font-mystic" style={{ fontSize: '0.8rem', color: '#fff' }}>{mood.label}</span></button>
              ))}
            </div>
            <button onClick={() => handleSelectMood(null)} style={{ marginTop: '24px', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.7rem', cursor: 'pointer', textDecoration: 'underline' }}>跳过，听凭天命</button>
          </motion.div>
        )}

        {/* Drawing & Result */}
        {(phase === 'idle' || phase === 'selecting' || phase === 'flipping' || phase === 'revealed' || phase === 'analyzing' || phase === 'done') && (
          <motion.div key="tarot-stage" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <motion.div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '100px', fontSize: '0.5rem', marginBottom: '20px', zIndex: 10, background: 'var(--primary-dim)', border: '1px solid rgba(255, 195, 0, 0.3)', color: 'var(--primary)', letterSpacing: '1px' }}>
              <Clock size={10} />
              <span>
                {phase === 'done' ? '命运已揭晓 · 随时可重新观测' : 
                 phase === 'revealed' ? '牌面已现，请开启契约解析' :
                 phase === 'analyzing' ? '正在连接高维能量场...' :
                 `正在通过${DIVINATION_METHODS.find(m => m.id === divinationMethod)?.label || '占卜'}指引方向`}
              </span>
            </motion.div>

            <div style={{ position: 'relative', width: '100%', height: '360px', zIndex: 2 }}>
              <MagicCircle />
              <div className="tarot-spread" style={{ height: '100%', alignItems: 'center' }}>
                {Array.from({ length: SPREAD_COUNT }).map((_, i) => {
                  const isSelected = selectedIndex === i;
                  const hasSelection = selectedIndex !== null;
                  const isHidden = hasSelection && !isSelected;
                  const offset = i - Math.floor(SPREAD_COUNT / 2);
                  const rotation = offset * 10;
                  const xOffset = offset * 42;
                  const yOffset = Math.abs(offset) * 18;
                  if (isDone && !isSelected) return null;
                  return (
                    <motion.div key={i} className="tarot-card" style={{ position: 'absolute', width: '160px', height: '240px', transformStyle: 'preserve-3d', cursor: (hasSelection || phase === 'done') ? 'default' : 'pointer' }} animate={{ x: isSelected ? 0 : isHidden ? (offset < 0 ? -350 : 350) : xOffset, y: isSelected ? -20 : isHidden ? 300 : yOffset, rotateZ: isSelected ? 0 : isHidden ? rotation * 3 : rotation, rotateY: isSelected && (phase !== 'idle' && phase !== 'selecting') ? 180 : 0, scale: isSelected ? 1.7 : isHidden ? 0.4 : 1, opacity: isHidden ? 0 : 1, zIndex: isSelected ? 50 : 10 - Math.abs(offset) }} transition={{ type: 'spring', stiffness: 65, damping: 14 }} onClick={() => handleSelectCard(i)}>
                      <div className="tarot-face tarot-back" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', border: isSelected ? '1px solid var(--primary)' : '1px solid var(--glass-border)' }}>
                        {divinationMethod === 'bazi' ? <Compass size={28} color="var(--primary)" style={{ opacity: 0.6 }} /> : <Wand2 size={28} color="var(--primary)" style={{ opacity: 0.6 }} />}
                      </div>
                      <div className="tarot-face tarot-front" style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        padding: '16px', 
                        border: '3px solid var(--primary)', 
                        overflow: 'hidden',
                        background: 'linear-gradient(180deg, rgba(20,20,20,1) 0%, rgba(35,30,10,1) 100%)',
                        boxShadow: 'inset 0 0 40px rgba(255, 195, 0, 0.1)'
                      }}>
                        {result && (
                          <>
                            {/* Card Header (Centered for Premium Feel) */}
                            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                              <motion.div 
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                style={{ fontSize: '1.8rem', marginBottom: '4px', filter: 'drop-shadow(0 0 10px rgba(255,195,0,0.3))' }}
                              >
                                {result.card.emoji}
                              </motion.div>
                              <h3 className="font-mystic text-gradient-gold" style={{ fontSize: '0.85rem', letterSpacing: '1px' }}>
                                {result.card.name}
                              </h3>
                              <div style={{ width: '30px', height: '1px', background: 'var(--primary)', margin: '6px auto', opacity: 0.5 }} />
                              
                              {phase === 'analyzing' && (
                                <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <div className="spinner-sm" />
                                  <span style={{ fontSize: '0.55rem', color: 'var(--primary)', fontWeight: 'bold' }}>{elapsedTime}s</span>
                                </div>
                              )}
                            </div>

                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                              {phase === 'revealed' && (
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', minHeight: 0 }}>
                                  <div style={{ 
                                    flex: 1, 
                                    overflowY: 'auto', 
                                    marginBottom: '10px',
                                    width: '100%',
                                    padding: '0 8px',
                                    // Remove centered alignment to prevent scroll issues with long text
                                  }}>
                                    <p style={{ 
                                      fontSize: '0.48rem', 
                                      color: '#e2e2e2', 
                                      textAlign: 'center', 
                                      lineHeight: 1.6,
                                      fontStyle: 'italic',
                                      opacity: 0.9
                                    }}>
                                      「 {result.card.meaning} 」
                                    </p>
                                  </div>
                                  <motion.button 
                                    whileHover={{ scale: 1.02, backgroundColor: 'rgba(255, 195, 0, 0.15)' }}
                                    whileTap={{ scale: 0.98 }}
                                    className="pixel-panel"
                                    style={{ 
                                      position: 'relative',
                                      padding: '8px 20px', 
                                      background: 'rgba(0, 0, 0, 0.6)',
                                      border: '1px solid rgba(255, 255, 255, 0.1)',
                                      borderRadius: '8px',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      gap: '4px',
                                      flexShrink: 0,
                                      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                                      overflow: 'hidden'
                                    }} 
                                    onClick={(e) => { e.stopPropagation(); handleStartAI(); }}
                                  >
                                    {/* Glowing Border Animation */}
                                    <motion.div 
                                      style={{
                                        position: 'absolute',
                                        inset: 0,
                                        border: '1px solid var(--primary)',
                                        borderRadius: '8px',
                                        zIndex: 0,
                                      }}
                                      animate={{ 
                                        opacity: [0.3, 0.8, 0.3],
                                        boxShadow: [
                                          'inset 0 0 5px var(--primary)',
                                          'inset 0 0 15px var(--primary)',
                                          'inset 0 0 5px var(--primary)'
                                        ]
                                      }}
                                      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                                    />

                                    {/* Shimmer Effect */}
                                    <motion.div 
                                      style={{
                                        position: 'absolute',
                                        top: 0, left: '-100%', width: '50%', height: '100%',
                                        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
                                        skewX: -20,
                                        zIndex: 1
                                      }}
                                      animate={{ left: '200%' }}
                                      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1 }}
                                    />

                                    <div style={{ position: 'relative', zIndex: 2, whiteSpace: 'nowrap' }}>
                                      <span style={{ 
                                        fontSize: '0.65rem', 
                                        fontWeight: 600, 
                                        color: '#fff', 
                                        letterSpacing: '2px',
                                        textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                                      }}>
                                        解开契约
                                      </span>
                                    </div>
                                  </motion.button>


                                </div>
                              )}


                              {(phase === 'analyzing' || phase === 'done') && (
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                                  <div style={{ 
                                    flex: 1, 
                                    overflowY: 'auto', 
                                    fontSize: '0.45rem', 
                                    lineHeight: 1.8, 
                                    color: '#f4f4f5', 
                                    textAlign: 'justify', 
                                    padding: '10px',
                                    background: 'rgba(0,0,0,0.2)',
                                    border: '1px solid rgba(255,195,0,0.1)',
                                    borderRadius: '4px'
                                  }}>
                                    {result.reading || (phase === 'analyzing' && '命运之轮正在咬合...')}
                                  </div>
                                  
                                  {phase === 'done' && (
                                    <motion.button 
                                      initial={{ opacity: 0, y: 10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      className="btn btn-primary btn-full" 
                                      style={{ marginTop: '10px', padding: '8px', fontSize: '0.65rem' }} 
                                      onClick={(e) => { e.stopPropagation(); navigate('/map'); }}
                                    >
                                      <MapPin size={14} style={{ marginRight: '6px' }} /> 开启寻宝之旅
                                    </motion.button>
                                  )}
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>

                    </motion.div>
                  );
                })}
              </div>
            </div>


            {isDone && (
              <motion.button 
                whileHover={{ scale: 1.05, background: 'rgba(255,255,255,0.1)' }}
                whileTap={{ scale: 0.95 }}
                onClick={handleReset} 
                style={{ 
                  marginTop: '40px', 
                  background: 'rgba(0,0,0,0.5)', 
                  border: '2px solid var(--primary)', 
                  color: 'var(--primary)', 
                  padding: '12px 32px', 
                  borderRadius: '4px', 
                  fontSize: '0.9rem', 
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  zIndex: 100,
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  boxShadow: '0 0 15px rgba(255,208,0,0.2)'
                }}
              >
                <Compass size={18} /> 重新观测命运
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
