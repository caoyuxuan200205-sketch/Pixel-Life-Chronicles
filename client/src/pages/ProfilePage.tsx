import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Settings, ChevronRight, Box, Award, Shield, LogOut, Camera, Trash2, Book, Map as MapIcon, Calendar, ShoppingCart, MapPin, Scissors, Info } from 'lucide-react';
import { getStamps, clearStamps, getCurrentUser, logout, type StampRecord } from '../store';

export const ProfilePage = () => {
  const navigate = useNavigate();
  const stamps = getStamps();
  const user = getCurrentUser();

  const [showSettings, setShowSettings] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [selectedStamp, setSelectedStamp] = useState<StampRecord | null>(null);
  const [showPatternInDetail, setShowPatternInDetail] = useState(false);

  const handleClearClick = () => setShowClearConfirm(true);
  
  const confirmClear = () => {
    clearStamps();
    setShowClearConfirm(false);
    window.location.reload();
  };

  const handleLogin = () => navigate('/auth');

  const handleLogoutClick = () => setShowLogoutConfirm(true);

  const confirmLogout = () => {
    logout();
    window.location.reload();
  };

  const handleSettings = () => setShowSettings(true);
  const handleAchievements = () => setShowAchievements(true);
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
          <h3 className="font-mystic" style={{ fontSize: '1.1rem' }}>📦 我的城市图鉴</h3>
          {stamps.length > 0 && (
            <button onClick={handleClearClick} style={{ background: 'transparent', border: 'none', color: '#cc5555', fontSize: '0.7rem', cursor: 'pointer', fontFamily: 'inherit' }}>[ 清空 ]</button>
          )}
        </div>
        <div className="pixel-panel" style={{ padding: stamps.length === 0 ? '40px 20px' : '16px' }}>
          {stamps.length === 0 ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>📷</div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>还没有收集到印章，快去占卜寻宝吧</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {stamps.map((stamp: StampRecord) => (
                <motion.div 
                  key={stamp.id} 
                  whileTap={{ scale: 0.95 }} 
                  onClick={() => setSelectedStamp(stamp)}
                  style={{ background: 'var(--bg-surface)', padding: '10px', border: '1px solid var(--pixel-border-color)', position: 'relative', cursor: 'pointer' }}
                >
                  <img src={stamp.pixelImageData} alt={stamp.poiName} style={{ width: '100%', height: 'auto', imageRendering: 'pixelated' }} />
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stamp.poiName}</div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--primary)' }}>{stamp.cardName}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ===== 菜单列表 ===== */}
      <div style={{ padding: '0 20px', position: 'relative' }}>
        <div className="pixel-panel" style={{ padding: 0 }}>
          {[
            { icon: '🏅', label: '我的成就', value: '4', onClick: handleAchievements },
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-overlay" style={{ overflowY: 'auto' }} onClick={() => { setSelectedStamp(null); setShowPatternInDetail(false); }}>
            <motion.div initial={{ y: 50 }} animate={{ y: 0 }} className="pixel-panel" style={{ width: '100%', maxWidth: '360px', padding: '24px', background: 'var(--bg-surface)', margin: '40px 20px' }} onClick={e => e.stopPropagation()}>
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
                <button className="btn btn-ghost" style={{ flex: 1, fontSize: '0.75rem' }} onClick={() => setShowPatternInDetail(!showPatternInDetail)}>
                  <Info size={14} /> {showPatternInDetail ? '隐藏图纸' : '查看拼豆图纸'}
                </button>
              </div>

              {showPatternInDetail && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} style={{ marginBottom: '24px', textAlign: 'center' }}>
                  <div style={{ background: '#fff', padding: '4px', display: 'inline-block' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${selectedStamp.beadPattern.grid[0].length}, 1fr)`, width: '200px' }}>
                      {selectedStamp.beadPattern.grid.flat().map((cIdx, i) => (
                        <div key={i} style={{ aspectRatio: '1', background: selectedStamp.beadPattern.palette[cIdx], border: '0.1px solid rgba(0,0,0,0.05)' }} />
                      ))}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '8px' }}>拼豆图纸：32x32 标准规格</div>
                </motion.div>
              )}

              {/* 商业化模块 */}
              <div style={{ borderTop: '2px solid var(--pixel-border-color)', paddingTop: '20px' }}>
                <h4 className="font-mystic" style={{ color: 'var(--primary)', fontSize: '0.9rem', marginBottom: '12px' }}>🛒 实体化印章</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button className="btn btn-primary" style={{ justifyContent: 'flex-start', padding: '12px', background: 'linear-gradient(45deg, #FFD000, #FFA500)', color: '#000' }}>
                    <ShoppingCart size={16} />
                    <div style={{ marginLeft: '10px', textAlign: 'left' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 900 }}>美团闪购：拼豆材料包</div>
                    </div>
                  </button>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'flex-start', padding: '10px', fontSize: '0.7rem' }}>
                      <MapPin size={14} color="var(--primary)" /> 附近工坊
                    </button>
                    <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'flex-start', padding: '10px', fontSize: '0.7rem' }}>
                      <Scissors size={14} color="var(--primary)" /> 工坊代做
                    </button>
                  </div>
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

        {/* 成就弹窗 */}
        {showAchievements && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-overlay" onClick={() => setShowAchievements(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="pixel-panel modal-content" onClick={e => e.stopPropagation()}>
              <h3 className="font-mystic" style={{ marginBottom: '20px', textAlign: 'center', color: 'var(--primary)' }}>成就图鉴</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', textAlign: 'center' }}>
                {[{ icon: '👟', name: '先行者', done: true }, { icon: '☕', name: '咖啡狂', done: true }, { icon: '📚', name: '求索家', done: true }, { icon: '📷', name: '摄影师', done: true }, { icon: '🗺️', name: '测绘员', done: false }, { icon: '💎', name: '收藏家', done: false }].map((item, i) => (
                  <div key={i} style={{ opacity: item.done ? 1 : 0.3 }}>
                    <div style={{ fontSize: '24px', marginBottom: '4px' }}>{item.icon}</div>
                    <div style={{ fontSize: '0.5rem', color: 'var(--text-muted)' }}>{item.name}</div>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowAchievements(false)} className="btn btn-primary" style={{ width: '100%', marginTop: '24px' }}>收起</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.85);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .modal-content {
          width: 100%;
          maxWidth: 320px;
          padding: 24px;
          background: var(--bg-surface);
          text-align: center;
        }
      `}</style>
    </div>
  );
};
