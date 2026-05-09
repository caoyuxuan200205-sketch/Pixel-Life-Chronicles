import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Save, RotateCcw, ChevronLeft, ShoppingCart, MapPin, Scissors, Info, Loader2, Sparkles, X, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { saveStamp, type StampRecord, getCurrentReading, getCurrentUser, type BeadPattern } from '../store';

/**
 * 拼豆色板（常见拼豆基础色）
 */
const BEAD_COLORS = [
  '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', 
  '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080',
  '#A52A2A', '#808080', '#FFC0CB', '#FFE4B5', '#40E0D0'
];

/**
 * 将图片转换为拼豆图纸数据
 */
async function generateBeadData(dataUrl: string, gridSize = 32): Promise<{ pixelUrl: string, pattern: BeadPattern }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      canvas.width = gridSize;
      canvas.height = gridSize;
      
      // 1. 像素化绘制
      ctx.drawImage(img, 0, 0, gridSize, gridSize);
      const imgData = ctx.getImageData(0, 0, gridSize, gridSize).data;
      
      const grid: number[][] = [];
      const palette = [...BEAD_COLORS];
      
      // 2. 颜色量化 & 网格提取
      for (let y = 0; y < gridSize; y++) {
        const row: number[] = [];
        for (let x = 0; x < gridSize; x++) {
          const idx = (y * gridSize + x) * 4;
          const r = imgData[idx];
          const g = imgData[idx + 1];
          const b = imgData[idx + 2];
          
          // 寻找最接近的拼豆颜色
          let minDist = Infinity;
          let colorIdx = 0;
          palette.forEach((hex, i) => {
            const hr = parseInt(hex.slice(1,3), 16);
            const hg = parseInt(hex.slice(3,5), 16);
            const hb = parseInt(hex.slice(5,7), 16);
            const dist = Math.sqrt((r-hr)**2 + (g-hg)**2 + (b-hb)**2);
            if (dist < minDist) {
              minDist = dist;
              colorIdx = i;
            }
          });
          row.push(colorIdx);
        }
        grid.push(row);
      }

      // 3. 生成预览图
      const previewCanvas = document.createElement('canvas');
      const pctx = previewCanvas.getContext('2d')!;
      const cellSize = 8;
      previewCanvas.width = gridSize * cellSize;
      previewCanvas.height = gridSize * cellSize;
      
      grid.forEach((row, y) => {
        row.forEach((cIdx, x) => {
          pctx.fillStyle = palette[cIdx];
          pctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
          // 添加网格线增强“图纸感”
          pctx.strokeStyle = 'rgba(0,0,0,0.1)';
          pctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
        });
      });

      resolve({
        pixelUrl: previewCanvas.toDataURL(),
        pattern: { grid, palette }
      });
    };
  });
}

export const CameraPage = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [beadResult, setBeadResult] = useState<{ pixelUrl: string, pattern: BeadPattern } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPatternView, setShowPatternView] = useState(false);
  
  // AI 探测状态
  const [searching, setSearching] = useState(false);
  const [statusIndex, setStatusIndex] = useState(0);
  const [nearbyShops, setNearbyShops] = useState<any[]>([]);
  const [selectedShop, setSelectedShop] = useState<any | null>(null);

  // 模拟业务弹窗状态
  const [showMeituanModal, setShowMeituanModal] = useState(false);
  const [showProxyModal, setShowProxyModal] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  const navigate = useNavigate();
  
  const reading = getCurrentReading();
  const user = getCurrentUser();

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

  useEffect(() => {
    if (!user) { navigate('/auth', { replace: true }); return; }
  }, [user, navigate]);

  useEffect(() => {
    if (!user || !reading) return;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => { if (videoRef.current) videoRef.current.srcObject = stream; })
      .catch(console.error);
    return () => {
      if (videoRef.current?.srcObject instanceof MediaStream) {
        videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      }
    };
  }, [user, reading]);

  if (!reading) {
    return (
      <div className="page" style={{ justifyContent: 'center', padding: '20px' }}>
        <div className="pixel-panel" style={{ padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '24px' }}>🚫</div>
          <h2 className="font-mystic" style={{ color: 'var(--primary)', marginBottom: '16px' }}>契约尚未开启</h2>
          <button onClick={() => navigate('/')} className="btn btn-primary" style={{ width: '100%' }}>返回占卜</button>
        </div>
      </div>
    );
  }

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    setCaptured(canvas.toDataURL('image/png'));
  };

  const handleProcess = async () => {
    if (!captured) return;
    setIsProcessing(true);
    // 模拟 AI 处理延迟
    await new Promise(r => setTimeout(r, 1500));
    const result = await generateBeadData(captured, 32);
    setBeadResult(result);
    setIsProcessing(false);
  };

  const searchNearbyShops = async () => {
    setSearching(true);
    setNearbyShops([]);
    
    // 模拟复杂的 AI 计算时间
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

  const handleSave = () => {
    if (!beadResult || !reading) return;
    const stamp: StampRecord = {
      id: `stamp_${Date.now()}`,
      poiName: reading.poi.name,
      poiType: reading.poi.type,
      pixelImageData: beadResult.pixelUrl,
      beadPattern: beadResult.pattern,
      createdAt: new Date().toISOString(),
      cardName: reading.card.name,
      reading: reading.reading,
    };
    saveStamp(stamp);
    navigate('/collection');
  };

  return (
    <div className="page page--fullscreen" style={{ position: 'relative', overflowY: 'auto', paddingBottom: '100px' }}>
      {/* 扫码框/取景框 */}
      <div style={{ width: '100%', height: '60vh', background: '#000', position: 'relative', overflow: 'hidden' }}>
        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: '40px', border: '2px solid var(--primary)', boxShadow: '0 0 0 1000px rgba(0,0,0,0.5)' }} />
        <div className="font-mystic" style={{ position: 'absolute', bottom: '20px', left: 0, right: 0, textAlign: 'center', color: 'var(--primary)', textShadow: '2px 2px 0 #000' }}>
          [ 正在对准：{reading.poi.name} ]
        </div>
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* 操作区 */}
      <div style={{ padding: '20px' }}>
        {!beadResult ? (
          <div style={{ textAlign: 'center' }}>
            <button 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '20px', fontSize: '1.2rem', marginBottom: '16px' }}
              onClick={captured ? handleProcess : handleCapture}
              disabled={isProcessing}
            >
              {isProcessing ? '⚡ AI 像素化处理中...' : (captured ? '✨ 生成拼豆图纸' : '📷 捕捉命运瞬间')}
            </button>
            {captured && (
              <button className="btn btn-ghost" onClick={() => setCaptured(null)}>重拍</button>
            )}
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {/* 结果显示 */}
            <div className="pixel-panel" style={{ padding: '16px', background: '#fff', marginBottom: '24px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', color: '#666', marginBottom: '12px' }}>AI 已完成实景重绘</div>
              <img 
                src={beadResult.pixelUrl} 
                alt="pixel" 
                style={{ width: '200px', height: '200px', imageRendering: 'pixelated', border: '4px solid #000' }} 
              />
              <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
                <button className="btn btn-ghost" style={{ flex: 1, fontSize: '0.8rem' }} onClick={() => setShowPatternView(true)}>
                  <Info size={14} /> 查看图纸
                </button>
                <button className="btn btn-primary" style={{ flex: 1, fontSize: '0.8rem' }} onClick={handleSave}>
                  <Save size={14} /> 存入图鉴
                </button>
              </div>
            </div>

            {/* 商业化模块 PRD 4.4 */}
            <div className="pixel-panel" style={{ padding: '20px', background: 'var(--bg-surface)' }}>
              <h4 className="font-mystic" style={{ color: 'var(--primary)', marginBottom: '16px', fontSize: '1rem' }}>🛒 实体化你的命运印章</h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
        )}
      </div>

      {/* 图纸弹窗 */}
      <AnimatePresence>
        {showPatternView && beadResult && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 2000, padding: '20px', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 className="font-mystic" style={{ color: 'var(--primary)' }}>拼豆操作图纸 (32x32)</h3>
              <button className="btn btn-ghost" onClick={() => setShowPatternView(false)}>关闭</button>
            </div>
            <div style={{ background: '#fff', padding: '4px', display: 'inline-block', margin: '0 auto' }}>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: `repeat(${beadResult.pattern.grid[0].length}, 1fr)`,
                width: '100%',
                maxWidth: '600px'
              }}>
                {beadResult.pattern.grid.flat().map((cIdx, i) => (
                  <div key={i} style={{ 
                    aspectRatio: '1', 
                    background: beadResult.pattern.palette[cIdx],
                    border: '0.1px solid rgba(0,0,0,0.05)',
                  }} />
                ))}
              </div>
            </div>
            <div style={{ marginTop: '20px', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
              💡 提示：每一格代表一颗拼豆，请对照颜色进行排列。
            </div>
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
