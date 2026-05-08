import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Save, RotateCcw, ChevronLeft, ShoppingCart, MapPin, Scissors, Info } from 'lucide-react';
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
  const navigate = useNavigate();
  
  const reading = getCurrentReading();
  const user = getCurrentUser();

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
    navigate('/profile');
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
                <button className="btn btn-primary" style={{ justifyContent: 'flex-start', padding: '16px', background: 'linear-gradient(45deg, #FFD000, #FFA500)', color: '#000' }}>
                  <ShoppingCart size={18} />
                  <div style={{ marginLeft: '12px', textAlign: 'left' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 900 }}>美团闪购：拼豆材料包</div>
                    <div style={{ fontSize: '0.6rem', opacity: 0.8 }}>匹配周边商家，30分钟送达</div>
                  </div>
                </button>

                <button className="btn btn-ghost" style={{ justifyContent: 'flex-start', padding: '16px', border: '1px solid var(--pixel-border-color)' }}>
                  <MapPin size={18} color="var(--primary)" />
                  <div style={{ marginLeft: '12px', textAlign: 'left' }}>
                    <div style={{ fontSize: '0.9rem' }}>前往周边拼豆店</div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>已为你预订最近的“手作工坊”</div>
                  </div>
                </button>

                <button className="btn btn-ghost" style={{ justifyContent: 'flex-start', padding: '16px', border: '1px solid var(--pixel-border-color)' }}>
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
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zInded: 2000, padding: '20px', overflowY: 'auto' }}
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
                    fontSize: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: cIdx === 0 ? '#fff' : '#000'
                  }}>
                    {/* 可选：在格子内显示颜色编号 */}
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
