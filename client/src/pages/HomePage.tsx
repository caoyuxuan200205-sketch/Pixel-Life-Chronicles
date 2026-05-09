import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Clock, MapPin, ChevronRight, Wand2, Compass, User as UserIcon, Calendar, Clock4 } from 'lucide-react';
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
  const [phase, setPhase] = useState<'intro' | 'method' | 'bazi_input' | 'mood' | 'idle' | 'selecting' | 'revealing' | 'done'>('intro');
  const [divinationMethod, setDivinationMethod] = useState<string | null>(null);
  const [baziInfo, setBaziInfo] = useState<BaziInfo>({ name: '', gender: 'female', birthDate: '2000-01-01', birthTime: '12:00' });
  const [selectedMood, setSelectedMood] = useState<MoodTag | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [result, setResult] = useState<ReadingResult | null>(null);
  const [hasExisting, setHasExisting] = useState(false);
  const [canDrawCard, setCanDrawCard] = useState(true);
  const [textRevealed, setTextRevealed] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState<string>('');

  useEffect(() => {
    const existing = getCurrentReading();
    setHasExisting(existing !== null);
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

    setTimeout(async () => {
      setPhase('revealing');
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
            geolocation.getCurrentPosition((status: string, result: any) => {
              if (status === 'complete') resolve(result); else reject(result);
            });
          });
          center = [pos.position.lng, pos.position.lat];
        } catch (e) { console.warn(e); }

        setLoadingMsg('寻找命定锚点...');
        const placeSearch = new AMap.PlaceSearch({ type: '咖啡馆|公园|美术馆|书店|唱片店|手作|风景名胜', pageSize: 20 });
        let realPois: POIData[] = [];
        try {
          const searchRes = await new Promise<any>((resolve, reject) => {
            placeSearch.searchNearBy('', center, 5000, (status: string, result: any) => {
              if (status === 'complete') resolve(result); else reject(result);
            });
          });
          if (searchRes.poiList?.pois) {
            realPois = searchRes.poiList.pois.map((p: any) => ({ id: p.id, name: p.name, type: p.type || '未知场所', rating: 4.5 + Math.random() * 0.5, tags: [p.type], distance: p.distance || 1000, direction: '附近', location: [p.location.lng, p.location.lat], address: p.address }));
          }
        } catch (e) { console.warn(e); }

        const { aiResult, card, poi } = await performAIReading(selectedMood, realPois, setLoadingMsg, divinationMethod || 'tarot', baziInfo);
        const newReading: ReadingResult = { card, poi, reading: aiResult.reading, drawnAt: new Date().toISOString() };
        saveReading(newReading);
        setResult(newReading);
      } catch (e) {
        console.error(e);
        const randomPOI = POI_DATABASE[Math.floor(Math.random() * POI_DATABASE.length)];
        const randomCard = TAROT_CARDS[index % TAROT_CARDS.length];
        const res: ReadingResult = { card: randomCard, poi: randomPOI, reading: generateReading(randomPOI, randomCard), drawnAt: new Date().toISOString() };
        saveReading(res);
        setResult(res);
      }
      setTimeout(() => {
        setPhase('done');
        setTextRevealed(true);
        setCanDrawCard(canDraw());
      }, 800);
    }, 800);
  }, [phase, canDrawCard, selectedMood, divinationMethod, baziInfo, navigate]);

  const handleReset = () => {
    resetForDemo();
    setPhase('intro');
    setSelectedIndex(null);
    setResult(null);
    setHasExisting(false);
    setTextRevealed(false);
    setCanDrawCard(true);
    setSelectedMood(null);
    setDivinationMethod(null);
  };

  const isDone = phase === 'done';

  return (
    <div className="page" style={{ alignItems: 'center', paddingTop: '40px', position: 'relative', overflow: 'hidden' }}>
      {/* 游戏风格背景装饰 */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 30%, rgba(255, 208, 0, 0.05) 0%, transparent 70%)', zIndex: 0 }} />
      <div className="crt-overlay" style={{ pointerEvents: 'none', zIndex: 100 }} />
      <FloatingParticles />

      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', zIndex: 2, marginBottom: '24px' }}>
        <h1 className="font-mystic text-gradient-full" style={{ fontSize: '3rem', fontWeight: 900, textShadow: '0 0 20px rgba(255, 208, 0, 0.3)' }}>像素生活志</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', letterSpacing: '6px', marginTop: '8px', opacity: 0.8 }}>别做攻略了，命运自有安排</p>
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
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}><UserIcon size={14} /> 姓名/代号</label>
                  <input type="text" required placeholder="输入你的名号" value={baziInfo.name} onChange={e => setBaziInfo({ ...baziInfo, name: e.target.value })} style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--pixel-border-color)', padding: '10px', color: '#fff', fontSize: '0.9rem' }} />
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>性别</label>
                    <select value={baziInfo.gender} onChange={e => setBaziInfo({ ...baziInfo, gender: e.target.value as any })} style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--pixel-border-color)', padding: '10px', color: '#fff' }}>
                      <option value="male">乾 (男)</option>
                      <option value="female">坤 (女)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}><Calendar size={14} /> 出生日期 (公历)</label>
                  <input type="date" required value={baziInfo.birthDate} onChange={e => setBaziInfo({ ...baziInfo, birthDate: e.target.value })} style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--pixel-border-color)', padding: '10px', color: '#fff' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}><Clock4 size={14} /> 出生时辰</label>
                  <input type="time" required value={baziInfo.birthTime} onChange={e => setBaziInfo({ ...baziInfo, birthTime: e.target.value })} style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--pixel-border-color)', padding: '10px', color: '#fff' }} />
                </div>
                <button type="submit" className="btn btn-primary" style={{ marginTop: '12px', padding: '12px' }}>定格时空</button>
                <button type="button" onClick={() => setPhase('method')} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.7rem' }}>返回选择其他形式</button>
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
        {(phase === 'idle' || phase === 'selecting' || phase === 'revealing' || phase === 'done') && (
          <motion.div key="tarot-stage" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <motion.div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 16px', borderRadius: '100px', fontSize: '0.78rem', marginBottom: '32px', zIndex: 10, background: 'var(--primary-dim)', border: '1px solid rgba(255, 195, 0, 0.3)', color: 'var(--primary)' }}>
              <Clock size={13} />
              <span>{isDone ? '命运已揭晓 · 随时可重新观测' : `正在通过${DIVINATION_METHODS.find(m => m.id === divinationMethod)?.label || '占卜'}指引方向`}</span>
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
                    <motion.div key={i} className="tarot-card" style={{ position: 'absolute', width: '160px', height: '240px', transformStyle: 'preserve-3d', cursor: hasSelection ? 'default' : 'pointer' }} animate={{ x: isSelected ? 0 : isHidden ? (offset < 0 ? -350 : 350) : xOffset, y: isSelected ? -20 : isHidden ? 300 : yOffset, rotateZ: isSelected ? 0 : isHidden ? rotation * 3 : rotation, rotateY: isSelected && phase !== 'idle' ? 180 : 0, scale: isSelected ? 1.7 : isHidden ? 0.4 : 1, opacity: isHidden ? 0 : 1, zIndex: isSelected ? 50 : 10 - Math.abs(offset) }} transition={{ type: 'spring', stiffness: 65, damping: 14 }} onClick={() => handleSelectCard(i)}>
                      <div className="tarot-face tarot-back" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', border: isSelected ? '1px solid var(--primary)' : '1px solid var(--glass-border)' }}>
                        {divinationMethod === 'bazi' ? <Compass size={28} color="var(--primary)" style={{ opacity: 0.6 }} /> : <Wand2 size={28} color="var(--primary)" style={{ opacity: 0.6 }} />}
                      </div>
                      <div className="tarot-face tarot-front" style={{ display: 'flex', flexDirection: 'column', padding: '16px', border: '2px solid var(--primary)' }}>
                        {result ? (
                          <>
                            <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>{result.card.emoji}</div>
                            <h3 className="font-mystic text-gradient-gold" style={{ fontSize: '0.9rem' }}>{result.card.name}</h3>
                            <AnimatePresence>{textRevealed && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ flex: 1, marginTop: '8px', overflowY: 'auto', fontSize: '0.45rem', lineHeight: 1.6, color: '#d4d4d8', textAlign: 'justify' }}>{result.reading}</motion.div>}</AnimatePresence>
                            {textRevealed && <button className="btn btn-primary btn-full" style={{ marginTop: '8px', padding: '6px', fontSize: '0.65rem' }} onClick={(e) => { e.stopPropagation(); navigate('/map'); }}><MapPin size={14} /> 开启寻宝之旅 <ChevronRight size={14} /></button>}
                          </>
                        ) : (
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /><p style={{ fontSize: '0.6rem', marginTop: '12px', color: 'var(--text-muted)' }}>{loadingMsg || '星象解析中...'}</p></div>
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
