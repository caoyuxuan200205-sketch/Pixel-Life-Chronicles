import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Clock, MapPin, ChevronRight } from 'lucide-react';
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
  type TarotCard,
} from '../store';
import { performAIReading, MOOD_TAGS, type MoodTag } from '../services/ai';


const SPREAD_COUNT = 5;

// ==========================================
// 粒子背景
// ==========================================
const FloatingParticles = () => {
  const particles = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3 + 1,
    delay: Math.random() * 5,
    duration: Math.random() * 4 + 4,
  }));

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {particles.map((p) => (
        <motion.div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: p.id % 2 === 0 ? 'var(--primary)' : 'rgba(255, 255, 255, 0.5)',
            opacity: 0.4,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.2, 0.7, 0.2],
            scale: [1, 1.4, 1],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
};

// ==========================================
// 占星罗盘装饰
// ==========================================
const AstrolabeDeco = () => (
  <div style={{
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '340px',
    height: '340px',
    pointerEvents: 'none',
    zIndex: 0,
    opacity: 0.08,
  }}>
    <div className="anim-spin-slow" style={{
      width: '100%',
      height: '100%',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '50%',
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute',
        inset: '20px',
        border: '1px dashed rgba(255, 255, 255, 0.15)',
        borderRadius: '50%',
      }} />
      <div style={{
        position: 'absolute',
        inset: '50px',
        border: '1px solid rgba(255,208,0,0.4)',
        borderRadius: '50%',
      }} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <div key={deg} style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '1px',
          height: '50%',
          background: 'rgba(255, 255, 255, 0.15)',
          transformOrigin: '0 0',
          transform: `rotate(${deg}deg)`,
        }} />
      ))}
    </div>
  </div>
);

// ==========================================
// 主页组件
// ==========================================
export const HomePage = () => {
  const navigate = useNavigate();

  // State
  const [phase, setPhase] = useState<'idle' | 'selecting' | 'revealing' | 'done'>('idle');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [result, setResult] = useState<ReadingResult | null>(null);
  const [hasExisting, setHasExisting] = useState(false);
  const [canDrawCard, setCanDrawCard] = useState(true);
  const [textRevealed, setTextRevealed] = useState(false);
  // 新增：用户情绪标签 (隐藏，默认使用“想随便走走”)
  const [selectedMood] = useState<MoodTag>(MOOD_TAGS[2]);
  const [loadingMsg, setLoadingMsg] = useState<string>('');

  // 初始化：检查已有占卜结果
  useEffect(() => {
    const existing = getCurrentReading();
    if (existing) {
      setResult(existing);
      setPhase('done');
      setHasExisting(true);
      setSelectedIndex(2);
      setTextRevealed(true);
    }
    setCanDrawCard(canDraw());
  }, []);

  // 抽卡逻辑
  const handleSelectCard = useCallback(async (index: number) => {
    if (phase !== 'idle' || !canDrawCard) return;

    // Check auth
    if (!getCurrentUser()) {
      alert('请先缔结契约（登录）以开启命运之旅。');
      navigate('/auth');
      return;
    }

    setSelectedIndex(index);
    setPhase('selecting');

    // 翻牌动画 -> 0.6秒后开始 AI 生成或本地兜底
    setTimeout(async () => {
      setPhase('revealing');

      try {
        setLoadingMsg('正在定位当前坐标...');
        
        // 配置安全密钥
        (window as any)._AMapSecurityConfig = {
          securityJsCode: '978b5cbccd4135876cc68dcddcd36977',
        };

        const AMap = await AMapLoader.load({
          key: '11fc39157bd652ff8c9a3faa0af916a2',
          version: '2.0',
          plugins: ['AMap.Geolocation', 'AMap.PlaceSearch'],
        });

        const geolocation = new AMap.Geolocation({
          enableHighAccuracy: true,
          timeout: 5000,
        });

        let center: [number, number] = [116.397, 39.900]; // 默认天安门
        try {
          const pos = await new Promise<any>((resolve, reject) => {
            geolocation.getCurrentPosition((status: string, result: any) => {
              if (status === 'complete') resolve(result);
              else reject(result);
            });
          });
          center = [pos.position.lng, pos.position.lat];
        } catch (e) {
          console.warn('定位失败，使用默认坐标', e);
        }

        setLoadingMsg('搜索附近隐秘坐标...');
        const placeSearch = new AMap.PlaceSearch({
          type: '独立咖啡馆|旧书店|公园绿地|手作体验|唱片店|咖啡|公园|风景|展览|艺术|清吧|猫咖',
          pageSize: 20,
          pageIndex: 1,
        });

        let realPois: POIData[] = [];
        try {
          const searchRes = await new Promise<any>((resolve, reject) => {
            placeSearch.searchNearBy('', center, 5000, (status: string, result: any) => {
              if (status === 'complete') resolve(result);
              else reject(result);
            });
          });
          
          if (searchRes.poiList && searchRes.poiList.pois) {
            realPois = searchRes.poiList.pois.map((p: any) => ({
              id: p.id,
              name: p.name,
              type: p.type || '未知场所',
              rating: 4.5 + Math.random() * 0.5,
              tags: [p.type],
              distance: p.distance || 1000,
              direction: '附近',
              location: [p.location.lng, p.location.lat],
              openHours: '09:00-22:00',
              address: p.address,
            }));
          }
        } catch (e) {
          console.warn('搜索周边失败', e);
        }

        const { aiResult, card, poi, isAI } = await performAIReading(selectedMood, realPois, setLoadingMsg);

        const newReading: ReadingResult = {
          card,
          poi,
          reading: aiResult.reading,
          drawnAt: new Date().toISOString(),
        };

        saveReading(newReading);
        setResult(newReading);
      } catch (e) {
        console.error('AI 抽卡异常，使用本地随机逻辑', e);
        const randomPOI = POI_DATABASE[Math.floor(Math.random() * POI_DATABASE.length)];
        const randomCard = TAROT_CARDS[index % TAROT_CARDS.length];
        const reading = generateReading(randomPOI, randomCard);
        const readingResult: ReadingResult = {
          card: randomCard,
          poi: randomPOI,
          reading,
          drawnAt: new Date().toISOString(),
        };
        saveReading(readingResult);
        setResult(readingResult);
      }

      // 文字逐步显现
      setTimeout(() => {
        setPhase('done');
        setTextRevealed(true);
        setCanDrawCard(canDraw());
      }, 800);
    }, 800);
  }, [phase, canDrawCard, selectedMood]);

  // 重置（演示用）
  const handleReset = () => {
    resetForDemo();
    setPhase('idle');
    setSelectedIndex(null);
    setResult(null);
    setHasExisting(false);
    setTextRevealed(false);
    setCanDrawCard(true);
  };

  const isDone = phase === 'done';

  return (
    <div className="page" style={{ alignItems: 'center', paddingTop: '48px', position: 'relative' }}>
      <FloatingParticles />

      {/* API 设置按钮 (Subtle) */}
      <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10 }}>
        <button 
          onClick={() => {
            const key = prompt('请输入豆包 API Key:');
            const mid = prompt('请输入模型 Endpoint ID:');
            if (key && mid) {
              import('../services/ai').then(m => m.configureDoubao(key, mid));
              alert('配置已保存！下次抽卡将调用真实 AI');
            }
          }}
          style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.2)', padding: '8px' }}
        >
          <Sparkles size={16} />
        </button>
      </div>

      {/* ===== 标题区域 ===== */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{ textAlign: 'center', zIndex: 2, marginBottom: '8px' }}
      >
        <h1
          className="font-mystic text-gradient-full"
          style={{ fontSize: '2.4rem', fontWeight: 900, lineHeight: 1.2, marginBottom: '8px' }}
        >
          像素生活志
        </h1>
        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '0.88rem',
          letterSpacing: '3px',
          fontWeight: 300,
        }}>
          别做攻略了，命运自有安排
        </p>
      </motion.div>

      {/* ===== FOMO 提示条 ===== */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 16px',
          borderRadius: '100px',
          fontSize: '0.78rem',
          fontWeight: 500,
          marginTop: '12px',
          marginBottom: '32px',
          zIndex: 2,
          background: isDone ? 'var(--bg-surface)' : 'var(--primary-dim)',
          border: isDone
            ? '1px solid var(--glass-border)'
            : '1px solid rgba(255, 195, 0, 0.3)',
          color: isDone ? 'var(--text-secondary)' : 'var(--primary)',
        }}
      >
        <Clock size={13} />
        <span>{isDone ? '命运已揭晓，本周无法更改' : `凭直觉抽取一张，本周仅限 2 次`}</span>
      </motion.div>

      {/* ===== 塔罗牌扇形区域 ===== */}
      <div style={{ position: 'relative', width: '100%', height: '360px', zIndex: 2 }}>
        <AstrolabeDeco />

        <div className="tarot-spread" style={{ height: '100%', alignItems: 'center' }}>
          {Array.from({ length: SPREAD_COUNT }).map((_, i) => {
            const isSelected = selectedIndex === i;
            const hasSelection = selectedIndex !== null;
            const isHidden = hasSelection && !isSelected;

            // 扇形布局
            const offset = i - Math.floor(SPREAD_COUNT / 2);
            const rotation = offset * 10;
            const xOffset = offset * 42;
            const yOffset = Math.abs(offset) * 18;

            if (isDone && !isSelected) return null;

            return (
              <motion.div
                key={i}
                className="tarot-card"
                style={{
                  position: 'absolute',
                  width: '160px',
                  height: '240px',
                  cursor: hasSelection ? 'default' : 'pointer',
                  transformStyle: 'preserve-3d',
                }}
                initial={false}
                animate={{
                  x: isSelected ? 0 : isHidden ? (offset < 0 ? -350 : 350) : xOffset,
                  y: isSelected ? -20 : isHidden ? 300 : yOffset,
                  rotateZ: isSelected ? 0 : isHidden ? rotation * 3 : rotation,
                  rotateY: isSelected && phase !== 'idle' ? 180 : 0,
                  scale: isSelected ? 1.7 : isHidden ? 0.4 : 1,
                  opacity: isHidden ? 0 : 1,
                  zIndex: isSelected ? 50 : 10 - Math.abs(offset),
                }}
                whileHover={!hasSelection ? { y: yOffset - 24, scale: 1.06, zIndex: 20 } : {}}
                transition={{ type: 'spring', stiffness: 65, damping: 14, mass: 1.1 }}
                onClick={() => handleSelectCard(i)}
              >
                {/* 卡背 */}
                <div
                  className="tarot-face tarot-back"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: isSelected
                      ? '1px solid var(--primary)'
                      : '1px solid var(--glass-border)',
                    boxShadow: isSelected
                      ? '0 0 40px var(--primary-glow), 0 0 80px rgba(255, 195, 0, 0.15)'
                      : '0 4px 20px rgba(0,0,0,0.5)',
                  }}
                >
                  <div style={{
                    width: '70%',
                    height: '75%',
                    border: '1px dashed rgba(255, 255, 255, 0.15)',
                    borderRadius: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                  }}>
                    <Sparkles
                      size={28}
                      color="var(--primary)"
                      style={{ opacity: 0.7 }}
                    />
                    <div style={{
                      width: '24px',
                      height: '24px',
                      border: '1px solid rgba(255, 195, 0, 0.3)',
                      transform: 'rotate(45deg)',
                    }} />
                  </div>
                </div>

                {/* 卡面 */}
                <div
                  className="tarot-face tarot-front"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    padding: '16px 14px',
                    border: '2px solid var(--primary)',
                    boxShadow: '0 0 40px var(--primary-glow), 0 0 80px rgba(255, 195, 0, 0.15)',
                  }}
                >
                  {result ? (
                    <>
                      {/* 卡名 */}
                      <div style={{
                        fontSize: '1.5rem',
                        marginBottom: '4px',
                        filter: 'drop-shadow(0 0 8px var(--primary-glow))',
                      }}>
                        {result.card.emoji}
                      </div>
                      <h3
                        className="font-mystic text-gradient-gold"
                        style={{ fontSize: '0.9rem', marginBottom: '2px', fontWeight: 700 }}
                      >
                        {result.card.name}
                      </h3>
                      <p style={{
                        fontSize: '0.5rem',
                        color: 'var(--text-secondary)',
                        marginBottom: '8px',
                        letterSpacing: '1px',
                      }}>
                        {result.card.meaning}
                      </p>

                      {/* 占卜正文 */}
                      <AnimatePresence>
                        {textRevealed && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.8 }}
                            style={{
                              flex: 1,
                              background: 'rgba(255,255,255,0.03)',
                              borderRadius: '8px',
                              padding: '8px',
                              border: '1px solid rgba(255, 195, 0, 0.15)',
                              overflowY: 'auto',
                              width: '100%',
                            }}
                          >
                            <p
                              className="font-mystic"
                              style={{
                                fontSize: '0.45rem',
                                lineHeight: 1.6,
                                color: '#d4d4d8',
                                textAlign: 'justify',
                              }}
                            >
                              {result.reading}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* 开启寻宝按钮 */}
                      {textRevealed && (
                        <motion.button
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 }}
                          className="btn btn-primary btn-full"
                          style={{
                            marginTop: '8px',
                            padding: '6px',
                            fontSize: '0.65rem',
                            borderRadius: '8px',
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate('/map');
                          }}
                        >
                          <MapPin size={14} />
                          开启迷雾寻宝
                          <ChevronRight size={14} />
                        </motion.button>
                      )}
                    </>
                  ) : (
                    <div style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '12px',
                    }}>
                      <div className="spinner" />
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '12px' }}>
                        {loadingMsg || '星象解析中...'}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ===== 底部提示 ===== */}
      {phase === 'idle' && !hasExisting && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          style={{
            color: 'var(--text-muted)',
            fontSize: '0.8rem',
            marginTop: '24px',
            zIndex: 2,
            textAlign: 'center',
          }}
        >
          ✨ 闭眼深呼吸，凭直觉点选一张牌
        </motion.p>
      )}

      {/* ===== 演示重置 ===== */}
      {isDone && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          onClick={handleReset}
          style={{
            marginTop: '20px',
            background: 'transparent',
            border: '1px solid var(--glass-border)',
            color: 'var(--text-muted)',
            padding: '8px 20px',
            borderRadius: '100px',
            fontSize: '0.75rem',
            cursor: 'pointer',
            zIndex: 2,
          }}
        >
          ⟳ 演示重置
        </motion.button>
      )}
    </div>
  );
};
