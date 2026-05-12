import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ShoppingCart, MapPin, Scissors, Info, Loader2, Sparkles, X } from 'lucide-react';
import { getStamps, clearStamps, getCurrentUser, logout, type StampRecord } from '../store';

export const ProfilePage = () => {
  const navigate = useNavigate();
  const [stamps, setStamps] = useState(getStamps());
  const [user, setUser] = useState(getCurrentUser());

  const [showSettings, setShowSettings] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [selectedStamp, setSelectedStamp] = useState<StampRecord | null>(null);
  const [showPatternInDetail, setShowPatternInDetail] = useState(false);
  const [showPatternView, setShowPatternView] = useState(false);

  // 导出逻辑
  const downloadByDataUrl = (dataUrl: string, filename: string) => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
  };

  const handleExport = async (type: 'png' | 'pdf') => {
    if (!selectedStamp) return;
    const BACKEND_URL = ''; // 使用相对路径适配生产环境
    const resp = await fetch(`${BACKEND_URL}/api/bead/export/${type}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grid: selectedStamp.beadPattern.grid,
        palette: selectedStamp.beadPattern.palette,
        cellSize: 14,
        showGrid: true,
      }),
    });
    if (!resp.ok) return;
    const data = await resp.json();
    if (data?.dataUrl) {
      downloadByDataUrl(data.dataUrl, `bead-pattern-${selectedStamp.poiName}-${Date.now()}.${type}`);
    }
  };

  // 计算颗粒数统计
  const getColorSummary = (grid: number[][], palette: string[], codes?: string[], names?: string[]) => {
    const counts: Record<number, number> = {};
    grid.flat().forEach(idx => {
      counts[idx] = (counts[idx] || 0) + 1;
    });
    return Object.entries(counts).map(([idx, count]) => {
      const i = parseInt(idx);
      return {
        index: i,
        hex: palette[i],
        count,
        code: codes ? codes[i] : null,
        name: names ? names[i] : null
      };
    }).sort((a, b) => b.count - a.count);
  };

  // AI 探测状态
  const [nearbyShops, setNearbyShops] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [statusIndex, setStatusIndex] = useState(0);
  const [selectedShop, setSelectedShop] = useState<any | null>(null);

  // 模拟业务弹窗状态
  const [showMeituanModal, setShowMeituanModal] = useState(false);
  const [showProxyModal, setShowProxyModal] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleMeituanPay = async () => {
    setIsPaying(true);
    await new Promise(r => setTimeout(r, 1500));
    setIsPaying(false);
    setShowMeituanModal(false);
    triggerToast('🚀 支付成功！美团骑手已出发，预计 30 分钟送达');
  };

  const handleProxyOrder = async () => {
    setIsOrdering(true);
    await new Promise(r => setTimeout(r, 2000));
    setIsOrdering(false);
    setShowProxyModal(false);
    triggerToast('🎨 契约已达成！工坊职人已接收图纸，制作完成后将第一时间顺丰寄出');
  };

  const SEARCH_STATUSES = [
    "正在解析印章像素指纹...",
    "同步高德时空坐标轴...",
    "检索美团周边生态网络...",
    "正在计算命定路径...",
    "发现 3 个命定坐标点！"
  ];

  useEffect(() => {
    let interval: any;
    if (searching) {
      interval = setInterval(() => {
        setStatusIndex((prev) => (prev < SEARCH_STATUSES.length - 1 ? prev + 1 : prev));
      }, 800);
    } else {
      setStatusIndex(0);
    }
    return () => clearInterval(interval);
  }, [searching]);

  const handleClearClick = () => setShowClearConfirm(true);

  const confirmClear = () => {
    clearStamps();
    setStamps([]);
    setShowClearConfirm(false);
  };

  const searchNearbyShops = async () => {
    setSearching(true);
    setNearbyShops([]);
    await new Promise(resolve => setTimeout(resolve, 4000));

    const mockShops = [
      {
        id: '1',
        name: 'Pixel Craft - 拼豆工作室 (三里屯店)',
        address: '朝阳区三里屯 SOHO 2号楼 5层',
        distance: 1200,
        type: 'DIY手作',
        rating: 4.9,
        tags: ['人气最高', '免费教学'],
        phone: '010-88889999',
        openTime: '10:00 - 22:00'
      },
      {
        id: '2',
        name: 'MEITUAN DIY - 像素艺术馆',
        address: '朝阳区亮马桥路 48号',
        distance: 2500,
        type: '艺术工坊',
        rating: 4.8,
        tags: ['支持闪购', '代工首选'],
        phone: '010-66667777',
        openTime: '09:00 - 21:00'
      },
      {
        id: '3',
        name: '手工客 拼豆 DIY 工坊',
        address: '东城区东直门外大街',
        distance: 3800,
        type: '亲子手工',
        rating: 4.7,
        tags: ['老字号', '款式齐全'],
        phone: '010-55554444',
        openTime: '10:00 - 20:00'
      }
    ];

    setNearbyShops(mockShops);
    setSearching(false);
  };

  const handleLogin = () => navigate('/auth');

  const handleLogoutClick = () => setShowLogoutConfirm(true);

  const confirmLogout = () => {
    logout();
    setUser(null);
    setShowLogoutConfirm(false);
    navigate('/profile');
  };

  const handleSettings = () => setShowSettings(true);
  const handleAchievements = () => alert('🏆 成就系统正在初始化中...\n\n继续收集印章以解锁“先锋探索者”称号！');
  const handlePrivacy = () => {
    alert('🔒 你的隐私已被“像素加密”。\n\n所有数据均存储在本地（LocalStorage），我们不会上传你的位置或代号。');
  };

  return (
    <div className="page" style={{ padding: '0 0 80px 0', overflowY: 'auto' }}>
      {/* ===== 个人信息头部 ===== */}
      <div style={{ padding: '60px 24px 24px 24px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '24px', right: '24px' }}>
          <button onClick={handleSettings} className="btn btn-ghost btn-icon" style={{ padding: '6px' }}>⚙️</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ width: '76px', height: '76px', background: '#25221F', border: '4px solid #4a433a', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 4px 4px 0px rgba(0,0,0,0.5)', fontSize: '40px' }}>
            🤠
          </div>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '8px' }}>{user ? user.username : '未登录'}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ background: user ? 'var(--primary)' : 'var(--bg-surface)', border: '2px solid var(--pixel-border-color)', color: user ? '#000' : 'var(--text-muted)', fontSize: '0.65rem', padding: '2px 6px', fontWeight: 700 }}>
                {user ? `LV.${user.level} 城市学徒` : '暂无等级'}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>经验值: {user ? `${user.exp}/500` : '-/-'}</span>
            </div>
          </div>
        </div>
        {!user && (
          <button onClick={handleLogin} className="btn btn-primary" style={{ width: '100%', marginTop: '24px' }}>立即登录 / 注册</button>
        )}
      </div>

      {/* ===== 数据统计 ===== */}
      <div style={{ padding: '0 20px', marginBottom: '24px' }}>
        <div className="pixel-panel" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', padding: '16px 0', textAlign: 'center' }}>
          <div style={{ borderRight: '2px solid var(--pixel-border-color)' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>📔 {stamps.length}</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>收集印章</div>
          </div>
          <div style={{ borderRight: '2px solid var(--pixel-border-color)' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>🗺️ 12 🔥</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>探索点</div>
          </div>
          <div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>📅 8</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>连续签到</div>
          </div>
        </div>
      </div>

      {/* ===== 图鉴区域 ===== */}
      <div style={{ padding: '0 20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 
            className="font-mystic" 
            style={{ fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            onClick={() => navigate('/collection')}
          >
            📦 我的城市图鉴 <ChevronRight size={14} />
          </h3>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button 
              onClick={() => navigate('/collection')} 
              style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontSize: '0.7rem', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              [ 查看全部 ]
            </button>
            {stamps.length > 0 && (
              <button onClick={handleClearClick} style={{ background: 'transparent', border: 'none', color: '#cc5555', fontSize: '0.7rem', cursor: 'pointer', fontFamily: 'inherit' }}>[ 清空 ]</button>
            )}
          </div>
        </div>
        <div className="pixel-panel" style={{ padding: stamps.length === 0 ? '40px 20px' : '12px', overflow: 'hidden' }}>
          {stamps.length === 0 ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>📷</div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>还没有收集到印章，快去占卜寻宝吧</p>
            </div>
          ) : (
            <div 
              className="no-scrollbar"
              style={{ 
                display: 'flex', 
                gap: '12px', 
                overflowX: 'auto', 
                scrollSnapType: 'x mandatory',
                paddingBottom: '4px' // 为投影留出一点空间
              }}
            >
              {stamps.map((stamp: StampRecord) => (
                <motion.div 
                  key={stamp.id} 
                  whileTap={{ scale: 0.96 }} 
                  onClick={() => setSelectedStamp(stamp)}
                  style={{ 
                    flex: '0 0 160px', // 固定宽度，确保左右滑动感
                    scrollSnapAlign: 'start',
                    background: 'rgba(255,255,255,0.03)', 
                    padding: '8px', 
                    border: '1px solid var(--pixel-border-color)', 
                    position: 'relative', 
                    cursor: 'pointer' 
                  }}
                >
                  <div style={{ background: '#000', padding: '4px', marginBottom: '8px' }}>
                    <img src={stamp.pixelImageData} alt={stamp.poiName} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', imageRendering: 'pixelated' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stamp.poiName}</div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--primary)', marginTop: '2px' }}>{stamp.cardName}</div>
                  </div>
                </motion.div>
              ))}
              {/* 占位符，确保最后一张也能对齐 */}
              <div style={{ flex: '0 0 1px' }} />
            </div>
          )}
        </div>
      </div>

      {/* ===== 菜单列表 ===== */}
      <div style={{ padding: '0 20px', position: 'relative' }}>
        <div className="pixel-panel" style={{ padding: 0 }}>
          {[
            { icon: '🏅', label: '我的成就', value: '敬请期待', onClick: handleAchievements },
            { icon: '🛡️', label: '隐私与安全', value: '', onClick: handlePrivacy },
            ...(user ? [{ icon: '🚪', label: '退出登录', value: '', danger: true, onClick: handleLogoutClick }] : []),
          ].map((item, idx, arr) => (
            <motion.button 
              key={idx} 
              whileHover={{ background: 'rgba(255,255,255,0.05)' }}
              whileTap={{ scale: 0.98, background: 'rgba(255,255,255,0.1)' }}
              onClick={item.onClick} 
              style={{ 
                width: '100%',
                padding: '16px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px', 
                border: 'none',
                background: 'transparent',
                borderBottom: idx === arr.length - 1 ? 'none' : '2px solid var(--pixel-border-color)', 
                cursor: 'pointer',
                textAlign: 'left',
                color: 'inherit',
                fontFamily: 'inherit'
              }}
            >
              <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
              <span style={{ flex: 1, fontSize: '0.9rem', color: item.danger ? '#cc5555' : 'var(--text-primary)' }}>{item.label}</span>
              {item.value && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginRight: '8px' }}>{item.value}</span>}
              <ChevronRight size={16} color="var(--pixel-border-color)" />
            </motion.button>
          ))}
        </div>
      </div>

      {/* ===== 弹窗区域 ===== */}
      <AnimatePresence>
        {/* 清空确认 */}
        {showClearConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-overlay" onClick={() => setShowClearConfirm(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="pixel-panel modal-content" onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>🗑️</div>
              <h3 className="font-mystic" style={{ color: '#cc5555', marginBottom: '12px' }}>清空图鉴？</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>一旦清空，你收集的所有命运印章将永远消失。</p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setShowClearConfirm(false)} className="btn btn-ghost" style={{ flex: 1 }}>保留</button>
                <button onClick={confirmClear} className="btn btn-primary" style={{ flex: 1, background: '#cc5555' }}>清空</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* 印章详情 PRD 4.3/4.4 */}
        {selectedStamp && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-overlay" onClick={() => { setSelectedStamp(null); setShowPatternInDetail(false); }}>
            <motion.div initial={{ y: 50 }} animate={{ y: 0 }} className="pixel-panel modal-content" style={{ padding: '24px' }} onClick={e => e.stopPropagation()}>
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <img 
                  src={selectedStamp.pixelImageData} 
                  alt="pixel" 
                  style={{ width: '180px', height: '180px', imageRendering: 'pixelated', border: '4px solid #000', marginBottom: '16px' }} 
                />
                <h2 className="font-mystic" style={{ fontSize: '1.2rem', color: 'var(--primary)', marginBottom: '4px' }}>{selectedStamp.poiName}</h2>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{selectedStamp.cardName} · {new Date(selectedStamp.createdAt).toLocaleDateString()}</div>
              </div>

              <div className="pixel-panel" style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', marginBottom: '20px' }}>
                <p style={{ fontSize: '0.8rem', lineHeight: 1.6, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  "{selectedStamp.reading}"
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
                <button className="btn btn-primary" style={{ flex: 1, fontSize: '0.85rem' }} onClick={() => setShowPatternView(true)}>
                  <Info size={16} /> 进入操作图纸界面
                </button>
              </div>

              {/* 商业化模块 */}
              <div style={{ borderTop: '2px solid var(--pixel-border-color)', paddingTop: '20px' }}>
                <h4 className="font-mystic" style={{ color: 'var(--primary)', fontSize: '0.9rem', marginBottom: '12px' }}>🛒 实体化印章</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  
                  {/* 材料包 */}
                  <button 
                    className="btn btn-primary" 
                    onClick={() => setShowMeituanModal(true)}
                    style={{ justifyContent: 'flex-start', padding: '16px', background: 'linear-gradient(45deg, #FFD000, #FFA500)', color: '#000' }}
                  >
                    <ShoppingCart size={18} />
                    <div style={{ marginLeft: '12px', textAlign: 'left' }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 900 }}>美团闪购：拼豆材料包</div>
                      <div style={{ fontSize: '0.6rem', opacity: 0.8 }}>匹配周边商家，30分钟送达</div>
                    </div>
                  </button>

                  {/* AI 寻找功能 */}
                  <button 
                    className="btn btn-ghost" 
                    disabled={searching}
                    onClick={searchNearbyShops}
                    style={{ justifyContent: 'flex-start', padding: '16px', border: '1px solid var(--pixel-border-color)', position: 'relative', overflow: 'hidden' }}
                  >
                    {searching ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Loader2 size={16} className="anim-spin" />
                        <span style={{ fontSize: '0.8rem' }}>{SEARCH_STATUSES[statusIndex]}</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <MapPin size={18} color="var(--primary)" />
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontSize: '0.9rem' }}>前往周边拼豆店</div>
                          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>已为你预订最近的“手作工坊”</div>
                        </div>
                      </div>
                    )}
                    {searching && (
                      <motion.div 
                        style={{ position: 'absolute', bottom: 0, left: 0, height: '2px', background: 'var(--primary)' }}
                        animate={{ width: ['0%', '100%'] }}
                        transition={{ duration: 4, ease: 'linear' }}
                      />
                    )}
                  </button>

                  <AnimatePresence>
                    {nearbyShops.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}
                      >
                        {nearbyShops.map(shop => (
                          <div 
                            key={shop.id} 
                            onClick={() => setSelectedShop(shop)}
                            style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center', 
                              padding: '12px', 
                              background: 'rgba(255,195,0,0.05)',
                              border: '1px solid var(--primary-dim)',
                              cursor: 'pointer'
                            }}
                          >
                            <div>
                              <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '0.75rem' }}>{shop.name}</div>
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.6rem' }}>{(shop.distance/1000).toFixed(1)}km · ★{shop.rating}</div>
                            </div>
                            <ChevronRight size={16} color="var(--primary)" />
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button 
                    className="btn btn-ghost" 
                    onClick={() => setShowProxyModal(true)}
                    style={{ justifyContent: 'flex-start', padding: '16px', border: '1px solid var(--pixel-border-color)' }}
                  >
                    <Scissors size={18} color="var(--primary)" />
                    <div style={{ marginLeft: '12px', textAlign: 'left' }}>
                      <div style={{ fontSize: '0.9rem' }}>手作工坊代制作</div>
                      <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>凭图纸线下核销，快递发货</div>
                    </div>
                  </button>
                </div>
              </div>

              <button onClick={() => { setSelectedStamp(null); setShowPatternInDetail(false); }} className="btn btn-primary" style={{ width: '100%', marginTop: '24px' }}>返回</button>
            </motion.div>
          </motion.div>
        )}

        {/* 退出确认 */}
        {showLogoutConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-overlay" onClick={() => setShowLogoutConfirm(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="pixel-panel modal-content" onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>🚪</div>
              <h3 className="font-mystic" style={{ marginBottom: '16px', color: '#cc5555' }}>退出旅程?</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>你确定要暂时离开这个像素世界吗？</p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setShowLogoutConfirm(false)} className="btn btn-ghost" style={{ flex: 1 }}>取消</button>
                <button onClick={confirmLogout} className="btn btn-primary" style={{ flex: 1, background: '#cc5555' }}>确定</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* 设置弹窗 */}
        {showSettings && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-overlay" onClick={() => setShowSettings(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="pixel-panel modal-content" onClick={e => e.stopPropagation()}>
              <h3 className="font-mystic" style={{ marginBottom: '20px', textAlign: 'center', color: 'var(--primary)' }}>系统设置</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>背景音乐</span><button className="btn btn-ghost btn-sm" onClick={() => alert('🎵 暂无音源')}>OFF</button></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>震动反馈</span><button className="btn btn-primary btn-sm">ON</button></div>
              </div>
              <button onClick={() => setShowSettings(false)} className="btn btn-primary" style={{ width: '100%', marginTop: '24px' }}>返回</button>
            </motion.div>
          </motion.div>
        )}

        {/* 商家详情弹窗 */}
        {selectedShop && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedShop(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)' }} />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="pixel-panel"
              style={{ width: '100%', maxWidth: '360px', background: 'var(--bg-dark)', zIndex: 3001, padding: '24px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h3 className="font-mystic" style={{ color: 'var(--primary)' }}>命定时空锚点</h3>
                <button className="btn btn-ghost" style={{ padding: '4px', border: 'none' }} onClick={() => setSelectedShop(null)}><X size={20} /></button>
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#fff', marginBottom: '4px' }}>{selectedShop.name}</div>
                <div style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '12px' }}>★ {selectedShop.rating} · {selectedShop.type}</div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    <MapPin size={16} /> {selectedShop.address}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    <Loader2 size={16} /> 营业时间：{selectedShop.openTime}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                {selectedShop.tags.map((tag: string) => (
                  <span key={tag} style={{ background: 'var(--primary-dim)', color: 'var(--primary)', padding: '2px 8px', fontSize: '0.65rem' }}>{tag}</span>
                ))}
              </div>

              <div style={{ background: 'rgba(255,195,0,0.1)', padding: '16px', marginBottom: '24px', border: '1px dashed var(--primary)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--primary)', marginBottom: '4px' }}>AI 契约已同步：</div>
                <div style={{ fontSize: '0.8rem', color: '#fff' }}>到店出示“命定印章”可享 85 折优惠并获赠新手工具包。</div>
              </div>

              <button 
                className="btn btn-primary" 
                style={{ width: '100%', padding: '14px' }}
                onClick={() => {
                  setSelectedShop(null);
                  setBookingSuccess(true);
                  setTimeout(() => setBookingSuccess(false), 3000);
                }}
              >
                立即预约到店创作
              </button>
            </motion.div>
          </div>
        )}

        {/* 美团闪购模拟 */}
        {showMeituanModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !isPaying && setShowMeituanModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)' }} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="pixel-panel" style={{ width: '100%', maxWidth: '360px', background: '#FFD000', color: '#000', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h3 style={{ fontWeight: 900 }}>美团闪购</h3>
                <X onClick={() => !isPaying && setShowMeituanModal(false)} style={{ cursor: 'pointer' }} />
              </div>
              <div style={{ background: '#fff', padding: '16px', marginBottom: '20px' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 900, marginBottom: '8px' }}>[全套] 命定拼豆材料包</div>
                <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '16px' }}>包含：全色系拼豆、背板、镊子、熨烫纸、收纳盒</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f40' }}>¥ 19.9 <span style={{ fontSize: '0.7rem', fontWeight: 'normal', color: '#999', textDecoration: 'line-through' }}>¥ 35.0</span></div>
              </div>
              <button 
                className="btn btn-primary" 
                disabled={isPaying}
                onClick={handleMeituanPay}
                style={{ width: '100%', background: '#000', color: '#FFD000', border: 'none', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
              >
                {isPaying ? <><Loader2 className="anim-spin" size={18} /> 量子加密支付中...</> : '确认支付并配送'}
              </button>
            </motion.div>
          </div>
        )}

        {/* 代制作模拟 */}
        {showProxyModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !isOrdering && setShowProxyModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)' }} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="pixel-panel" style={{ width: '100%', maxWidth: '360px', background: 'var(--bg-dark)', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h3 className="font-mystic" style={{ color: 'var(--primary)' }}>工坊代制作契约</h3>
                <X onClick={() => !isOrdering && setShowProxyModal(false)} style={{ cursor: 'pointer' }} />
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '24px' }}>
                <p style={{ marginBottom: '12px' }}>您可以将生成的像素图纸发送给我们的“命定工坊”，由专业职人为您手工制作并快递寄送。</p>
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', border: '1px dashed var(--primary-dim)' }}>
                  <div style={{ marginBottom: '4px' }}>• 制作周期：1-2 工作日</div>
                  <div style={{ marginBottom: '4px' }}>• 快递时效：顺丰同城/空运</div>
                  <div>• 代工费用：¥ 39.0 起</div>
                </div>
              </div>
              <button 
                className="btn btn-primary" 
                disabled={isOrdering}
                onClick={handleProxyOrder}
                style={{ width: '100%', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
              >
                {isOrdering ? <><Loader2 className="anim-spin" size={18} /> 图纸时空同步中...</> : '同步图纸并下单'}
              </button>
            </motion.div>
          </div>
        )}

        {/* 统一成功提示 Toast */}
        <AnimatePresence>
          {showToast && (
            <motion.div 
              initial={{ opacity: 0, y: 50 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: 50 }}
              style={{ position: 'fixed', bottom: '100px', left: '20px', right: '20px', zIndex: 9000, pointerEvents: 'none', display: 'flex', justifyContent: 'center' }}
            >
              <div className="pixel-panel" style={{ background: 'var(--primary)', color: '#000', padding: '12px 20px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 10px 30px rgba(255,208,0,0.4)', fontSize: '0.8rem' }}>
                <Sparkles size={16} />
                <span>{toastMessage}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 预约成功提示 */}
        {bookingSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: 50 }}
            style={{ position: 'fixed', bottom: '120px', left: '20px', right: '20px', zIndex: 5000, pointerEvents: 'none', display: 'flex', justifyContent: 'center' }}
          >
            <div className="pixel-panel" style={{ background: 'var(--primary)', color: '#000', padding: '12px 24px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 10px 30px rgba(255,208,0,0.4)' }}>
              <Sparkles size={18} />
              <span>预约成功！时空锚点已为您锁定</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 图纸弹窗 - 全屏沉浸式 (与创作界面一致) */}
      <AnimatePresence>
        {showPatternView && selectedStamp && (
          <motion.div 
            initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1 }}
            style={{ 
              position: 'fixed', 
              inset: 0, 
              background: 'var(--bg-dark)', 
              zIndex: 6000, 
              padding: '24px 24px var(--nav-height) 24px', 
              overflowY: 'auto' 
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h3 className="font-mystic" style={{ color: 'var(--primary)', fontSize: '1.2rem' }}>拼豆操作图纸</h3>
                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>规格：{selectedStamp.beadPattern.grid[0].length} x {selectedStamp.beadPattern.grid.length}</p>
              </div>
              <button className="btn btn-ghost" onClick={() => setShowPatternView(false)} style={{ border: 'none', background: 'rgba(255,255,255,0.05)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ background: '#fff', padding: '8px', display: 'flex', justifyContent: 'center', marginBottom: '24px', boxShadow: '0 0 50px rgba(0,0,0,0.5)' }}>
               <div style={{ 
                display: 'grid', 
                gridTemplateColumns: `repeat(${selectedStamp.beadPattern.grid[0].length}, 1fr)`,
                width: '100%',
                maxWidth: '600px'
              }}>
                {selectedStamp.beadPattern.grid.flat().map((cIdx, i) => (
                  <div key={i} style={{ aspectRatio: '1', background: selectedStamp.beadPattern.palette[cIdx], border: '0.1px solid rgba(0,0,0,0.1)' }} />
                ))}
              </div>
            </div>

            {/* 导出按钮 */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '32px' }}>
              <button className="btn btn-ghost" style={{ flex: 1, fontSize: '0.8rem' }} onClick={() => handleExport('png')}>导出图片</button>
              <button className="btn btn-ghost" style={{ flex: 1, fontSize: '0.8rem' }} onClick={() => handleExport('pdf')}>导出 PDF</button>
            </div>

            {/* 颜色详情 */}
            <div className="pixel-panel" style={{ padding: '20px', background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--primary)', marginBottom: '16px', fontWeight: 'bold' }}>使用的豆子详情</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {getColorSummary(
                  selectedStamp.beadPattern.grid, 
                  selectedStamp.beadPattern.palette,
                  selectedStamp.beadPattern.codes,
                  selectedStamp.beadPattern.names
                ).slice(0, 16).map((c) => (
                  <div key={c.index} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(0,0,0,0.3)', padding: '10px' }}>
                    <div style={{ width: '16px', height: '16px', background: c.hex, border: '1px solid rgba(255,255,255,0.2)' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.7rem', color: '#fff' }}>{c.code || `#${c.index}`}</div>
                      <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{c.name || '未知颜色'} · {c.count} 颗</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginTop: '20px', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
              💡 提示：每一格代表一颗拼豆，请对照颜色进行排列。
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
