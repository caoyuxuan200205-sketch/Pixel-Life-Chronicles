import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, X, Trash2, Info, ShoppingCart, MapPin, Scissors, Calendar, Loader2, Sparkles, ChevronRight } from 'lucide-react';
import { getStamps, clearStamps, type StampRecord } from '../store';

interface NearbyShop {
  id: string;
  name: string;
  address: string;
  distance: number;
  type: string;
  rating: number;
  tags: string[];
  phone?: string;
  openTime?: string;
}

const SEARCH_STATUSES = [
  "正在解析印章像素指纹...",
  "同步高德时空坐标轴...",
  "检索美团周边生态网络...",
  "正在计算命定路径...",
  "发现 3 个命定坐标点！"
];

export const CollectionPage = () => {
  const navigate = useNavigate();
  const [stamps, setStamps] = useState<StampRecord[]>(getStamps());
  const [selectedStamp, setSelectedStamp] = useState<StampRecord | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // 附近商家搜索状态
  const [nearbyShops, setNearbyShops] = useState<NearbyShop[]>([]);
  const [searching, setSearching] = useState(false);
  const [statusIndex, setStatusIndex] = useState(0);
  const [selectedShop, setSelectedShop] = useState<NearbyShop | null>(null);

  // 模拟业务弹窗状态
  const [showMeituanModal, setShowMeituanModal] = useState(false);
  const [showProxyModal, setShowProxyModal] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

  useEffect(() => {
    const fetchCloudStamps = async () => {
      setIsSyncing(true);
      try {
        const supabaseModule = await import('../lib/supabase');
        const { data: { session } } = await supabaseModule.supabase.auth.getSession();
        
        if (session?.access_token) {
          const resp = await fetch(`${BACKEND_URL}/api/stamps`, {
            headers: { 'Authorization': `Bearer ${session.access_token}` }
          });
          if (resp.ok) {
            const cloudStamps = await resp.json();
            const mappedCloud: StampRecord[] = cloudStamps.map((s: any) => ({
              id: s.id,
              poiName: s.poi_name,
              poiType: s.poi_type,
              pixelImageData: s.pixel_image_data,
              reading: s.reading,
              cardName: s.card_name,
              createdAt: s.created_at,
              beadPattern: { grid: Array(32).fill(0).map(() => Array(32).fill(0)), palette: ['#000000', '#ffffff'] }
            }));

            setStamps(prev => {
              const combined = [...prev, ...mappedCloud];
              const unique = Array.from(new Map(combined.map(s => [s.poiName + s.createdAt, s])).values());
              return unique.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            });
          }
        }
      } catch (e) {
        console.error('Failed to sync stamps:', e);
      } finally {
        setIsSyncing(false);
      }
    };

    fetchCloudStamps();
  }, [BACKEND_URL]);

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

  const handleClear = () => {
    clearStamps();
    setStamps([]);
    setShowClearConfirm(false);
  };

  const searchNearbyShops = async () => {
    setSearching(true);
    setNearbyShops([]);
    
    // 模拟复杂的 AI 计算时间
    await new Promise(resolve => setTimeout(resolve, 4000));

    const mockShops: NearbyShop[] = [
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

  return (
    <div className="page" style={{ padding: '20px 20px var(--nav-height) 20px', position: 'relative' }}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ marginBottom: '24px', textAlign: 'center', marginTop: '10px' }}
      >
        <h2 className="font-mystic text-gradient-mystic" style={{ fontSize: '1.6rem' }}>
          城市命定图鉴
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          你的每一次冒险都留下了一枚像素印章，点亮城市的星光。
        </p>
        {isSyncing && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '12px', color: 'var(--primary)', fontSize: '0.7rem' }}
          >
            <Loader2 size={12} className="anim-spin" />
            <span>正在同步云端记录...</span>
          </motion.div>
        )}
      </motion.div>

      {stamps.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '60px' }}>
          <Camera size={48} style={{ opacity: 0.4 }} />
          <p style={{ marginTop: '12px', marginBottom: '20px' }}>暂无印章，快去探索吧 🚀</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>开启今日占卜</button>
        </div>
      ) : (
        <div className="grid" style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', 
          gap: '16px',
          paddingBottom: '40px'
        }}>
          {stamps.map((stamp: StampRecord) => (
            <motion.div
              key={stamp.id}
              className="pixel-panel"
              whileHover={{ scale: 1.02, y: -5 }}
              onClick={() => {
                setSelectedStamp(stamp);
                setNearbyShops([]);
              }}
              style={{
                padding: '12px',
                textAlign: 'center',
                background: 'var(--bg-surface)',
                cursor: 'pointer'
              }}
            >
              <div style={{ background: '#000', padding: '2px', marginBottom: '10px' }}>
                <img 
                  src={stamp.pixelImageData} 
                  alt={stamp.poiName} 
                  style={{ width: '100%', height: 'auto', imageRendering: 'pixelated' }} 
                />
              </div>
              <h4 className="font-mystic" style={{ margin: '4px 0', fontSize: '0.9rem', color: 'var(--primary)' }}>{stamp.poiName}</h4>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', opacity: 0.7 }}>
                 <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{stamp.cardName}</span>
                 <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>•</span>
                 <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{new Date(stamp.createdAt).toLocaleDateString()}</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* 清空按钮 */}
      {stamps.length > 0 && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="btn btn-ghost"
          style={{ 
            position: 'absolute', 
            top: '20px', 
            right: '20px', 
            padding: '8px 12px',
            fontSize: '0.7rem',
            border: 'none',
            boxShadow: 'none'
          }}
          onClick={() => setShowClearConfirm(true)}
        >
          <Trash2 size={14} style={{ marginRight: '4px' }} /> 清空
        </motion.button>
      )}

      <AnimatePresence>
        {/* 详情弹窗 */}
        {selectedStamp && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-overlay" onClick={() => setSelectedStamp(null)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="pixel-panel modal-content"
              style={{ padding: '24px' }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                  <h3 className="font-mystic" style={{ color: 'var(--primary)', fontSize: '1.2rem' }}>{selectedStamp.poiName}</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{selectedStamp.poiType} · 已收集</p>
                </div>
                <button className="btn btn-ghost" style={{ padding: '8px', border: 'none', boxShadow: 'none' }} onClick={() => setSelectedStamp(null)}>
                  <X size={20} />
                </button>
              </div>

              <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                <div style={{ flex: '0 0 120px', background: '#000', padding: '4px', border: '2px solid var(--primary)' }}>
                  <img 
                    src={selectedStamp.pixelImageData} 
                    alt="pixel" 
                    style={{ width: '100%', height: 'auto', imageRendering: 'pixelated' }} 
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <span style={{ padding: '2px 6px', background: 'var(--primary-dim)', color: 'var(--primary)', fontSize: '0.65rem' }}>
                      {selectedStamp.cardName}
                    </span>
                    <Calendar size={12} color="var(--text-muted)" />
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{new Date(selectedStamp.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4', fontStyle: 'italic' }}>
                    "{selectedStamp.reading}"
                  </p>
                </div>
              </div>

              {/* 拼豆图纸部分 */}
              <div className="divider" />
              <h4 className="font-mystic" style={{ color: 'var(--primary)', fontSize: '0.9rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Info size={16} /> 拼豆生成图纸
              </h4>
              <div style={{ background: '#fff', padding: '4px', width: 'fit-content', margin: '0 auto 12px' }}>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: `repeat(${selectedStamp.beadPattern.grid[0].length}, 1fr)`,
                  width: '200px',
                  height: '200px'
                }}>
                  {selectedStamp.beadPattern.grid.flat().map((cIdx, i) => (
                    <div key={i} style={{ 
                      background: selectedStamp.beadPattern.palette[cIdx],
                      border: '0.1px solid rgba(0,0,0,0.05)'
                    }} />
                  ))}
                </div>
              </div>
              <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '24px' }}>
                💡 规格：32x32 标准拼豆网格
              </p>

              {/* 商业化模块 */}
              <div className="pixel-panel" style={{ padding: '16px', background: 'rgba(255,195,0,0.05)', borderColor: 'var(--primary-dim)' }}>
                <h5 className="font-mystic" style={{ fontSize: '0.8rem', color: 'var(--primary)', marginBottom: '12px' }}>🛒 实体化你的命运印章</h5>
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
            </motion.div>
          </motion.div>
        )}

        {/* 清空确认弹窗 */}
        {showClearConfirm && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowClearConfirm(false)}
              style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.9)' }}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="pixel-panel"
              style={{ 
                width: '100%', 
                maxWidth: '320px', 
                background: 'var(--bg-surface)',
                zIndex: 1101,
                padding: '24px',
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: '40px', marginBottom: '16px' }}>⚠️</div>
              <h3 className="font-mystic" style={{ color: '#ff4b4b', marginBottom: '12px' }}>清空图鉴？</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.5' }}>
                此操作将永久移除所有已收集的命定印章，无法恢复。
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowClearConfirm(false)}>取消</button>
                <button className="btn btn-primary" style={{ flex: 1, background: '#ff4b4b', borderColor: '#fff' }} onClick={handleClear}>确认清空</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 商家详情弹窗 */}
      <AnimatePresence>
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowMeituanModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)' }} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="pixel-panel" style={{ width: '100%', maxWidth: '360px', background: '#FFD000', color: '#000', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h3 style={{ fontWeight: 900 }}>美团闪购</h3>
                <X onClick={() => setShowMeituanModal(false)} style={{ cursor: 'pointer' }} />
              </div>
              <div style={{ background: '#fff', padding: '16px', marginBottom: '20px' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 900, marginBottom: '8px' }}>[全套] 命定拼豆材料包</div>
                <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '16px' }}>包含：全色系拼豆、背板、镊子、熨烫纸、收纳盒</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f40' }}>¥ 19.9 <span style={{ fontSize: '0.7rem', fontWeight: 'normal', color: '#999', textDecoration: 'line-through' }}>¥ 35.0</span></div>
              </div>
              <button className="btn btn-primary" style={{ width: '100%', background: '#000', color: '#FFD000', border: 'none', padding: '16px' }}>确认支付并配送</button>
            </motion.div>
          </div>
        )}

        {/* 代制作模拟 */}
        {showProxyModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowProxyModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)' }} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="pixel-panel" style={{ width: '100%', maxWidth: '360px', background: 'var(--bg-dark)', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h3 className="font-mystic" style={{ color: 'var(--primary)' }}>工坊代制作契约</h3>
                <X onClick={() => setShowProxyModal(false)} style={{ cursor: 'pointer' }} />
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '24px' }}>
                <p style={{ marginBottom: '12px' }}>您可以将生成的像素图纸发送给我们的“命定工坊”，由专业职人为您手工制作并快递寄送。</p>
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', border: '1px dashed var(--primary-dim)' }}>
                  <div style={{ marginBottom: '4px' }}>• 制作周期：1-2 工作日</div>
                  <div style={{ marginBottom: '4px' }}>• 快递时效：顺丰同城/空运</div>
                  <div>• 代工费用：¥ 39.0 起</div>
                </div>
              </div>
              <button className="btn btn-primary" style={{ width: '100%', padding: '16px' }}>同步图纸并下单</button>
            </motion.div>
          </div>
        )}

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
    </div>
  );
};
