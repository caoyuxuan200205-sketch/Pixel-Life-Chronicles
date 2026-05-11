import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Camera, Navigation, ChevronRight, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AMapLoader from '@amap/amap-jsapi-loader';
import { getCurrentReading, getCurrentUser, getRouteCache, saveRouteCache, type ReadingResult } from '../store';

export const MapPage = () => {
  const navigate = useNavigate();
  const [reading, setReading] = useState<ReadingResult | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const mapRef = useRef<any>(null);
  const walkingRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const isMapLoaded = useRef(false);

  useEffect(() => {
    if (!getCurrentUser()) {
      navigate('/auth', { replace: true });
      return;
    }
    const r = getCurrentReading();
    if (r) setReading(r);
  }, [navigate]);

  const drawRoute = (path: any[]) => {
    if (!mapRef.current) return;
    
    // 清除旧线
    if (routeLineRef.current) {
      mapRef.current.remove(routeLineRef.current);
    }

    // 绘制像素风格路径
    const polyline = new (window as any).AMap.Polyline({
      path: path,
      isOutline: true,
      outlineColor: '#000',
      borderWeight: 2,
      strokeColor: "#e2b553",
      strokeOpacity: 1,
      strokeWeight: 6,
      strokeStyle: "solid",
      lineJoin: 'round',
      lineCap: 'round',
      zIndex: 50,
    });

    mapRef.current.add(polyline);
    routeLineRef.current = polyline;
    
    // 只有在非初次恢复缓存时才自动调整视角，避免进入页面时的突兀跳转
    if (isMapLoaded.current) {
      mapRef.current.setFitView([polyline, userMarkerRef.current].filter(Boolean), false, [60, 60, 320, 60]);
    }
  };

  const planRoute = (userPos: any) => {
    if (!walkingRef.current || !reading) return;

    walkingRef.current.search(
      userPos,
      reading.poi.location,
      (status: string, result: any) => {
        if (status === 'complete' && result.routes && result.routes[0]) {
          const route = result.routes[0];
          const path = route.steps.reduce((acc: any[], step: any) => [...acc, ...step.path], []);
          drawRoute(path);
          
          const dist = route.distance > 1000 ? (route.distance / 1000).toFixed(1) + 'km' : route.distance + 'm';
          const time = Math.ceil(route.time / 60) + '分钟';
          
          const info = { distance: dist, duration: time };
          setRouteInfo(info);
          
          // 缓存路线
          saveRouteCache({ ...info, path });
        }
      }
    );
  };

  useEffect(() => {
    if (!reading) return;
    let mapInstance: any = null;

    const initMap = async () => {
      try {
        const container = document.getElementById('amap-container');
        if (container) container.style.backgroundColor = '#111111';
        (window as any)._AMapSecurityConfig = { securityJsCode: '978b5cbccd4135876cc68dcddcd36977' };
        
        const AMap = await AMapLoader.load({
          key: '11fc39157bd652ff8c9a3faa0af916a2',
          version: '2.0',
          plugins: ['AMap.Geolocation', 'AMap.Walking'],
        });

        mapInstance = new AMap.Map('amap-container', {
          zoom: 15,
          center: reading.poi.location,
          mapStyle: 'amap://styles/dark',
          viewMode: '2D',
        });

        mapRef.current = mapInstance;

        // 目的地 Marker
        const markerContent = document.createElement('div');
        markerContent.innerHTML = `
          <div style="width: 32px; height: 32px; background: var(--primary); border: 2px solid #000; display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 4px 4px 0 rgba(0,0,0,0.3);">
            📍
          </div>
        `;
        const marker = new AMap.Marker({
          position: reading.poi.location,
          content: markerContent,
          offset: new AMap.Pixel(-16, -16),
        });
        mapInstance.add(marker);

        // 立即尝试恢复缓存路线
        const cached = getRouteCache();
        if (cached) {
          setRouteInfo({ distance: cached.distance, duration: cached.duration });
          drawRoute(cached.path);
        }

        // 初始化导航插件
        walkingRef.current = new AMap.Walking({ map: null, hideMarkers: true });

        // 定位插件
        const geolocation = new AMap.Geolocation({
          enableHighAccuracy: true,
          timeout: 10000,
          buttonPosition: 'RB',
          buttonOffset: new AMap.Pixel(16, 260),
          showMarker: true,
          markerOptions: {
            content: `
              <div style="width: 16px; height: 16px; background: #fff; border: 2px solid #000; box-shadow: 2px 2px 0 #3366ff;">
                <div style="width: 6px; height: 6px; background: #3366ff; margin: 3px;"></div>
              </div>
            `,
            offset: new AMap.Pixel(-8, -8)
          },
          showCircle: false,
        });
        mapInstance.addControl(geolocation);

        geolocation.on('complete', (data: any) => {
          if (data.position) {
            planRoute([data.position.lng, data.position.lat]);
          }
        });

        // 初次尝试获取位置并规划（静默更新）
        geolocation.getCurrentPosition();
        
        isMapLoaded.current = true;
      } catch (err) {
        console.error('Map init error:', err);
      }
    };

    initMap();
    return () => { if (mapInstance) mapInstance.destroy(); };
  }, [reading]);

  if (!reading) {
    return (
      <div className="page" style={{ justifyContent: 'center', padding: '20px' }}>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="pixel-panel"
          style={{ padding: '40px 24px', textAlign: 'center' }}
        >
          <div style={{ fontSize: '64px', marginBottom: '24px' }}>🧭</div>
          <h2 className="font-mystic" style={{ color: 'var(--primary)', marginBottom: '16px' }}>契约尚未开启</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '32px' }}>
            迷雾笼罩着城市。你需要先返回探索界面进行今日占卜，命运之神才会为你揭示坐标。
          </p>
          <button 
            onClick={() => navigate('/')}
            className="btn btn-primary"
            style={{ width: '100%', gap: '8px' }}
          >
            <ChevronLeft size={18} />
            返回占卜
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="page page--fullscreen" style={{ position: 'relative' }}>
      <div id="amap-container" className="map-container" />
      
      <motion.div
        initial={{ y: 300, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="pixel-panel"
        style={{
          position: 'absolute',
          bottom: 'calc(var(--nav-height) + 16px)',
          left: '16px',
          right: '16px',
          padding: '20px',
          zIndex: 20,
          background: 'var(--bg-surface)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '0.65rem', color: 'var(--primary)', marginBottom: '4px' }}>
              {routeInfo ? `🏃 距离: ${routeInfo.distance} (约${routeInfo.duration})` : '🎯 目标坐标已锁定'}
            </div>
            <h2 className="font-mystic" style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>{reading.poi.name}</h2>
          </div>
          <div style={{ background: 'var(--primary)', color: '#000', padding: '4px 8px', fontSize: '0.6rem', fontWeight: 900 }}>冒险中</div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
          {reading.poi.tags.slice(0, 2).map((tag) => (
            <span key={tag} style={{ border: '1px solid var(--pixel-border-color)', padding: '2px 6px', fontSize: '0.6rem', color: 'var(--text-muted)' }}>#{tag}</span>
          ))}
          <span style={{ border: '1px solid var(--pixel-border-color)', padding: '2px 6px', fontSize: '0.6rem', color: 'var(--primary)' }}>★ {reading.poi.rating}</span>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn btn-ghost"
            style={{ flex: 1, fontSize: '0.8rem' }}
            onClick={() => mapRef.current?.setFitView()}
          >
            <Navigation size={14} /> 全览
          </button>
          <button
            className="btn btn-primary"
            style={{ flex: 1.5, fontSize: '0.8rem' }}
            onClick={() => navigate('/camera')}
          >
            <Camera size={14} /> 创作印章 <ChevronRight size={14} />
          </button>
        </div>
      </motion.div>
    </div>
  );
};
