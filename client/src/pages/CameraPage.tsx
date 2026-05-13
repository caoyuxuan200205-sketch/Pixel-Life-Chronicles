import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, ShoppingCart, MapPin, Scissors, Info, Loader2, Sparkles, X, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { track } from "@vercel/analytics";
import { saveStamp, type StampRecord, getCurrentReading, getCurrentUser, type BeadPattern } from '../store';

/**
 * 拼豆色板（常见拼豆基础色）
 */
const BEAD_COLORS = [
  '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', 
  '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080',
  '#A52A2A', '#808080', '#FFC0CB', '#FFE4B5', '#40E0D0'
];

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

/**
 * 将图片转换为拼豆图纸数据
 */
type BeadGenerateResult = { pixelUrl: string, pattern: BeadPattern, source: 'backend' | 'local', colorCount?: number };
type ColorSummaryItem = { index: number; hex: string; count: number };
type BeadMode = 'fixed_grid' | 'pixel_size';

type BeadGenerateResultEx = BeadGenerateResult & {
  sessionId?: string;
  colorSummary?: ColorSummaryItem[];
  totalBeads?: number;
};

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

async function generateBeadData(
  dataUrl: string,
  options: {
    mode: BeadMode;
    gridSize: number;
    pixelSize: number;
    palettePreset: '96' | '120' | '144' | '168' | '221';
    maxColors: number;
    mergeThreshold: number;
    useDithering: boolean;
    removeBg: boolean;
    contrast: number;
    saturation: number;
    sharpness: number;
  }
): Promise<BeadGenerateResultEx> {
  try {
    const resp = await fetchWithTimeout(`${BACKEND_URL}/api/bead/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataUrl,
        mode: options.mode,
        gridSize: options.gridSize,
        pixelSize: options.pixelSize,
        palettePreset: options.palettePreset,
        useDithering: options.useDithering,
        maxColors: options.maxColors,
        mergeThreshold: options.mergeThreshold,
        removeBg: options.removeBg,
        contrast: options.contrast,
        saturation: options.saturation,
        sharpness: options.sharpness,
      }),
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data?.pixelUrl && data?.pattern?.grid && data?.pattern?.palette) {
        return { ...data, source: 'backend' };
      }
    }
  } catch {
    // 后端不可用时自动回退到本地算法，保证功能可用
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = dataUrl;
    img.onerror = () => reject(new Error('图片解析失败'));
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
        pattern: { grid, palette },
        source: 'local',
      });
    };
  });
}

export const CameraPage = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [beadResult, setBeadResult] = useState<BeadGenerateResultEx | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingTip, setProcessingTip] = useState<string>('');
  const [showPatternView, setShowPatternView] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedColorIndex, setSelectedColorIndex] = useState<number>(0);
  const [engineMode, setEngineMode] = useState<BeadMode>('fixed_grid');
  const [gridSize, setGridSize] = useState(32);
  const [pixelSize, setPixelSize] = useState(8);
  const [palettePreset, setPalettePreset] = useState<'96' | '120' | '144' | '168' | '221'>('221');
  const [maxColors, setMaxColors] = useState(24);
  const [mergeThreshold, setMergeThreshold] = useState(18);
  const [useDithering, setUseDithering] = useState(false);
  const [removeBg, setRemoveBg] = useState(false);
  const [contrast, setContrast] = useState(12);
  const [saturation, setSaturation] = useState(10);
  const [sharpness, setSharpness] = useState(15);
  
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
    
    // 限制最大尺寸，避免移动端上传 Base64 过大导致后端 413 错误
    const MAX_DIM = 1024;
    let width = video.videoWidth;
    let height = video.videoHeight;
    
    if (width > height) {
      if (width > MAX_DIM) {
        height *= MAX_DIM / width;
        width = MAX_DIM;
      }
    } else {
      if (height > MAX_DIM) {
        width *= MAX_DIM / height;
        height = MAX_DIM;
      }
    }
    
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0, width, height);
    setCaptured(canvas.toDataURL('image/jpeg', 0.8)); // 使用 jpeg 且 0.8 质量进一步减小体积
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 1024;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_DIM) {
            height *= MAX_DIM / width;
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width *= MAX_DIM / height;
            height = MAX_DIM;
          }
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
        setCaptured(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleProcess = async () => {
    if (!captured) return;
    setIsProcessing(true);
    setProcessingTip('');

    // 检查后端配置
    if (BACKEND_URL.includes('localhost') && window.location.hostname !== 'localhost') {
      console.warn('检测到在非本地环境下尝试调用 localhost 后端，请检查 VITE_BACKEND_URL 环境变量设置。');
    }

    // 模拟 AI 处理延迟
    await new Promise(r => setTimeout(r, 1500));
    const startTime = Date.now();
    try {
      const result = await generateBeadData(captured, {
        mode: engineMode,
        gridSize,
        pixelSize,
        palettePreset,
        maxColors,
        mergeThreshold,
        useDithering,
        removeBg,
        contrast,
        saturation,
        sharpness,
      });
      const duration = (Date.now() - startTime) / 1000;
      track('bead_conversion_success', {
        duration,
        palette: palettePreset,
        grid_size: engineMode === 'fixed_grid' ? gridSize : pixelSize,
        engine_mode: engineMode,
        source: result.source,
      });
      setBeadResult(result);
      setSelectedColorIndex(0);
      if (result.source === 'local') {
        setProcessingTip('后端不可用（可能是部署配置问题），已回退本地生成。');
      }
    } catch (err: any) {
      console.error('Processing failed:', err);
      track('bead_conversion_error', { error: err.message || 'unknown' });
      setProcessingTip(`生成失败: ${err.message || '未知错误'}。请检查 Vercel Logs。`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCellClick = async (flatIndex: number) => {
    if (!beadResult || !editMode) return;
    const width = beadResult.pattern.grid[0].length;
    const row = Math.floor(flatIndex / width);
    const col = flatIndex % width;
    const next = beadResult.pattern.grid.map((r) => [...r]);
    next[row][col] = selectedColorIndex;
    setBeadResult({
      ...beadResult,
      pattern: { ...beadResult.pattern, grid: next },
    });
    if (beadResult.sessionId) {
      try {
        const resp = await fetch(`${BACKEND_URL}/api/bead/update-cell`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: beadResult.sessionId,
            row,
            col,
            colorIndex: selectedColorIndex,
          }),
        });
        if (resp.ok) {
          const data = await resp.json();
          setBeadResult((prev) => prev ? { ...prev, colorSummary: data.colorSummary, colorCount: data.colorCount, totalBeads: data.totalBeads } : prev);
        }
      } catch {
        // silent
      }
    }
  };

  const downloadByDataUrl = (dataUrl: string, filename: string) => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
  };

  const handleExport = async (type: 'png' | 'pdf') => {
    if (!beadResult) return;
    const resp = await fetch(`${BACKEND_URL}/api/bead/export/${type}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grid: beadResult.pattern.grid,
        palette: beadResult.pattern.palette,
        cellSize: 14,
        showGrid: true,
      }),
    });
    if (!resp.ok) return;
    const data = await resp.json();
    if (data?.dataUrl) {
      track('bead_export', { format: type });
      downloadByDataUrl(data.dataUrl, `bead-pattern-${Date.now()}.${type}`);
    }
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

  const handleSave = async () => {
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

    // 1. 本地保存 (保证离线可用)
    saveStamp(stamp);

    // 2. 云端同步 (BFF 中转)
    try {
      const { data: { session } } = await (await import('../lib/supabase')).supabase.auth.getSession();
      if (session?.access_token) {
        await fetch(`${BACKEND_URL}/api/stamps`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            poi_name: stamp.poiName,
            poi_type: stamp.poiType,
            pixel_image_data: stamp.pixelImageData,
            reading: stamp.reading,
            card_name: stamp.cardName
          })
        });
      }
    } catch (e) {
      console.error('Cloud sync failed:', e);
    }

    navigate('/collection');
  };

  return (
    <div className="page page--fullscreen" style={{ position: 'relative', overflow: 'hidden', background: '#000' }}>
      {/* 扫码框/取景框 - 占据全屏背景 */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, background: '#000' }}>
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          style={{ 
            width: '100%', 
            height: '100%', 
            objectFit: 'cover', 
            display: captured ? 'none' : 'block' 
          }} 
        />
        {captured && (
          <img 
            src={captured} 
            alt="Captured" 
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'cover', 
              filter: 'blur(10px) brightness(0.5)',
              transition: 'all 0.5s ease'
            }} 
          />
        )}
        {!captured && (
          <div style={{ position: 'absolute', inset: '40px', border: '2px solid rgba(226, 181, 83, 0.3)', boxShadow: '0 0 0 2000px rgba(0,0,0,0.4)', pointerEvents: 'none' }}>
            <div className="camera-corner camera-corner--tl" />
            <div className="camera-corner camera-corner--tr" />
            <div className="camera-corner camera-corner--bl" />
            <div className="camera-corner camera-corner--br" />
          </div>
        )}
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* 顶部导航状态 */}
      <motion.div 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '20px', zIndex: 10, background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ padding: '8px', minWidth: '40px', border: 'none', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
            <X size={20} />
          </button>
          <div style={{ textAlign: 'center' }}>
            <div className="font-mystic" style={{ color: 'var(--primary)', fontSize: '0.9rem', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
              {reading.poi.name}
            </div>
            <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.6)' }}>正在锚定时空坐标...</div>
          </div>
          <div style={{ width: '40px' }} />
        </div>
      </motion.div>

      {/* 底部操作面板 */}
      <AnimatePresence mode="wait">
        {!beadResult ? (
          <motion.div 
            key="controls"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            style={{ 
              position: 'absolute', 
              bottom: 'var(--nav-height)', 
              left: 0, 
              right: 0, 
              padding: '24px', 
              zIndex: 20,
              background: 'rgba(22, 20, 18, 0.85)',
              backdropFilter: 'blur(20px)',
              borderTop: '1px solid rgba(255, 195, 0, 0.2)',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.5)'
            }}
          >
            {captured ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 className="font-mystic" style={{ color: 'var(--primary)', fontSize: '1.1rem' }}>图纸引擎配置</h3>
                  <button className="btn btn-ghost" onClick={() => setCaptured(null)} style={{ padding: '4px 12px', fontSize: '0.7rem', border: 'none', background: 'rgba(255,255,255,0.05)' }}>
                    重拍
                  </button>
                </div>

                <div className="no-scrollbar" style={{ maxHeight: '45vh', overflowY: 'auto', paddingRight: '4px' }}>
                  {/* 网格设置 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                     <div className="pixel-panel" style={{ padding: '12px', background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '8px' }}>色板预设</div>
                        <select 
                          value={palettePreset} 
                          onChange={(e) => setPalettePreset(e.target.value as any)}
                          style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 'bold', outline: 'none' }}
                        >
                          {['96', '120', '144', '168', '221'].map(p => <option key={p} value={p}>{p} 色系</option>)}
                        </select>
                     </div>
                     <div className="pixel-panel" style={{ padding: '12px', background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '8px' }}>{engineMode === 'fixed_grid' ? '网格密度' : '像素精度'}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input 
                            type="number" 
                            value={engineMode === 'fixed_grid' ? gridSize : pixelSize}
                            onChange={(e) => engineMode === 'fixed_grid' ? setGridSize(Number(e.target.value)) : setPixelSize(Number(e.target.value))}
                            style={{ width: '40px', background: 'transparent', border: 'none', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 'bold', outline: 'none' }}
                          />
                          <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{engineMode === 'fixed_grid' ? 'GRID' : 'PX'}</span>
                        </div>
                     </div>
                  </div>

                  {/* 核心开关 */}
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                    <button 
                      onClick={() => setUseDithering(!useDithering)}
                      style={{ flex: 1, padding: '10px', background: useDithering ? 'var(--primary-dim)' : 'rgba(255,255,255,0.05)', border: useDithering ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)', color: useDithering ? 'var(--primary)' : 'var(--text-muted)', fontSize: '0.7rem', transition: 'all 0.3s' }}
                    >
                      Floyd 抖动 {useDithering ? 'ON' : 'OFF'}
                    </button>
                    <button 
                      onClick={() => setRemoveBg(!removeBg)}
                      style={{ flex: 1, padding: '10px', background: removeBg ? 'var(--primary-dim)' : 'rgba(255,255,255,0.05)', border: removeBg ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)', color: removeBg ? 'var(--primary)' : 'var(--text-muted)', fontSize: '0.7rem', transition: 'all 0.3s' }}
                    >
                      背景剥离 {removeBg ? 'ON' : 'OFF'}
                    </button>
                  </div>

                  {/* 图像微调 */}
                  <div className="pixel-panel" style={{ padding: '16px', background: 'rgba(0,0,0,0.2)', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {[
                        { label: '对比度', value: contrast, setter: setContrast, icon: '◑' },
                        { label: '饱和度', value: saturation, setter: setSaturation, icon: '❂' },
                        { label: '清晰度', value: sharpness, setter: setSharpness, icon: '▲' }
                      ].map(adj => (
                        <div key={adj.label}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ color: 'var(--primary)' }}>{adj.icon}</span> {adj.label}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 'bold' }}>{adj.value > 0 ? `+${adj.value}` : adj.value}</span>
                          </div>
                          <input 
                            type="range" min="-50" max="50" value={adj.value} 
                            onChange={(e) => adj.setter(Number(e.target.value))} 
                            style={{ 
                              width: '100%', 
                              height: '4px', 
                              appearance: 'none', 
                              background: 'rgba(255,255,255,0.1)', 
                              outline: 'none',
                              borderRadius: '2px'
                            }} 
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <button 
                  className="btn btn-primary" 
                  style={{ width: '100%', padding: '20px', fontSize: '1.1rem', background: 'var(--primary)', border: 'none', boxShadow: '0 10px 30px rgba(226, 181, 83, 0.3)' }}
                  onClick={handleProcess}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Loader2 size={20} className="anim-spin" />
                      <span>{processingTip || '量子纠缠渲染中...'}</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Sparkles size={20} />
                      <span>觉醒像素契约</span>
                    </div>
                  )}
                </button>
              </motion.div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ marginBottom: '24px' }}>
                   <motion.div 
                     animate={{ scale: [1, 1.1, 1] }}
                     transition={{ duration: 2, repeat: Infinity }}
                     style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'var(--primary)', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 30px var(--primary-glow)', cursor: 'pointer' }}
                     onClick={handleCapture}
                   >
                     <Save size={32} color="#000" />
                   </motion.div>
                   <p style={{ marginTop: '16px', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 'bold' }}>[ 捕捉今日命定瞬间 ]</p>
                </div>
                
                <div 
                  style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <span>或从星盘相册选择</span>
                  <ChevronRight size={14} />
                </div>
                <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleFileUpload} />
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div 
            key="results"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            style={{ 
              position: 'absolute', 
              inset: 0, 
              bottom: 'var(--nav-height)',
              zIndex: 30,
              background: 'var(--bg-dark)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 className="font-mystic text-gradient-mystic" style={{ fontSize: '1.4rem' }}>像素图灵重绘完成</h2>
              <button className="btn btn-ghost" onClick={() => setBeadResult(null)} style={{ border: 'none', background: 'rgba(255,255,255,0.05)' }}>
                <X size={20} />
              </button>
            </div>

            <div className="pixel-panel" style={{ padding: '24px', background: '#fff', marginBottom: '24px', textAlign: 'center' }}>
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3 }}>
                <img 
                  src={beadResult.pixelUrl} 
                  alt="pixel" 
                  style={{ width: '100%', maxWidth: '280px', aspectRatio: '1', imageRendering: 'pixelated', border: '6px solid #000', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }} 
                />
              </motion.div>
              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '20px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.6rem', color: '#999' }}>色数</div>
                  <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#333' }}>{beadResult.colorCount}</div>
                </div>
                <div style={{ width: '1px', height: '24px', background: '#eee' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.6rem', color: '#999' }}>总颗数</div>
                  <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#333' }}>{beadResult.totalBeads}</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
              <button className="btn btn-ghost" style={{ flex: 1, padding: '16px' }} onClick={() => setShowPatternView(true)}>
                <Info size={18} /> 查看图纸
              </button>
              <button className="btn btn-primary" style={{ flex: 1, padding: '16px' }} onClick={handleSave}>
                <Save size={18} /> 存入图鉴
              </button>
            </div>

            {/* 商业化模块 */}
            <div className="pixel-panel" style={{ padding: '20px', background: 'rgba(226, 181, 83, 0.05)', borderStyle: 'dashed' }}>
              <h4 className="font-mystic" style={{ color: 'var(--primary)', marginBottom: '16px', fontSize: '0.9rem' }}>🛒 实体化你的命定印章</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button className="btn btn-primary" onClick={() => setShowMeituanModal(true)} style={{ justifyContent: 'flex-start', padding: '16px', background: 'linear-gradient(45deg, #FFD000, #FFA500)', border: 'none', color: '#000' }}>
                  <ShoppingCart size={20} />
                  <div style={{ marginLeft: '12px', textAlign: 'left' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 900 }}>美团闪购：30min 送达材料包</div>
                    <div style={{ fontSize: '0.6rem', opacity: 0.8 }}>匹配周边商家</div>
                  </div>
                </button>
                <button className="btn btn-ghost" onClick={() => setShowProxyModal(true)} style={{ justifyContent: 'flex-start', padding: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <Scissors size={20} color="var(--primary)" />
                  <div style={{ marginLeft: '12px', textAlign: 'left' }}>
                    <div style={{ fontSize: '0.85rem' }}>代制作：由职人为你手工制作</div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>快递到家</div>
                  </div>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 图纸弹窗 - 全屏沉浸式 */}
      <AnimatePresence>
        {showPatternView && beadResult && (
          <motion.div 
            initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1 }}
            style={{ 
              position: 'fixed', 
              inset: 0, 
              background: 'var(--bg-dark)', 
              zIndex: 2000, 
              padding: '24px 24px var(--nav-height) 24px', 
              overflowY: 'auto' 
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h3 className="font-mystic" style={{ color: 'var(--primary)', fontSize: '1.2rem' }}>拼豆操作图纸</h3>
                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>规格：{beadResult.pattern.grid[0].length} x {beadResult.pattern.grid.length}</p>
              </div>
              <button className="btn btn-ghost" onClick={() => setShowPatternView(false)} style={{ border: 'none', background: 'rgba(255,255,255,0.05)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ background: '#fff', padding: '8px', display: 'flex', justifyContent: 'center', marginBottom: '24px', boxShadow: '0 0 50px rgba(0,0,0,0.5)' }}>
               <div style={{ 
                display: 'grid', 
                gridTemplateColumns: `repeat(${beadResult.pattern.grid[0].length}, 1fr)`,
                width: '100%',
                maxWidth: '600px'
              }}>
                {beadResult.pattern.grid.flat().map((cIdx, i) => (
                  <div key={i} style={{ aspectRatio: '1', background: beadResult.pattern.palette[cIdx], border: '0.1px solid rgba(0,0,0,0.1)' }} />
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
                {beadResult.colorSummary?.slice(0, 16).map((c: any) => (
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
