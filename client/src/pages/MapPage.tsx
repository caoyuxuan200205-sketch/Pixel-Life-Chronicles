import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Compass, Navigation, ChevronRight, ChevronLeft, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AMapLoader from '@amap/amap-jsapi-loader';
import { track } from "@vercel/analytics";
import { getLatestJointPlan, getCurrentUser, type JointPlanResult } from '../store';

export const MapPage = () => {
  const navigate = useNavigate();
  const [plan, setPlan] = useState<JointPlanResult | null>(null);
  const [activeStopIndex, setActiveStopIndex] = useState(0);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);

  const mapRef = useRef<any>(null);
  const walkingRef = useRef<any>(null);
  const routeLinesRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);
  const isMapLoaded = useRef(false);

  useEffect(() => {
    if (!getCurrentUser()) {
      navigate('/auth', { replace: true });
      return;
    }
    const latestPlan = getLatestJointPlan();
    if (latestPlan) {
      setPlan(latestPlan);
      track('map_view_joint_plan', { itinerary_length: latestPlan.itinerary.length });
    } else {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  // 顺序绘制多点路径折线
  const planMultiStopRoute = async (startPos: [number, number]) => {
    if (!walkingRef.current || !plan) return;

    const stops = plan.itinerary.map((item) => item.poi.location);
    const allPoints = [startPos, ...stops];

    // 清理旧折线
    if (routeLinesRef.current.length > 0) {
      routeLinesRef.current.forEach((line) => mapRef.current.remove(line));
    }
    routeLinesRef.current = [];

    let totalDist = 0;
    let totalDuration = 0;
    const colors = ['#e2b553', '#4ca3f5', '#ff5e5e', '#3cd070']; // Leg1:金色, Leg2:蓝色, Leg3:红色

    for (let i = 0; i < allPoints.length - 1; i++) {
      const from = allPoints[i];
      const to = allPoints[i + 1];

      await new Promise<void>((resolve) => {
        walkingRef.current.search(from, to, (status: string, result: any) => {
          if (status === 'complete' && result.routes && result.routes[0]) {
            const route = result.routes[0];
            totalDist += route.distance;
            totalDuration += route.time;

            const path = route.steps.reduce((acc: any[], step: any) => [...acc, ...step.path], []);

            // 绘制当前 Leg 折线
            const polyline = new (window as any).AMap.Polyline({
              path: path,
              isOutline: true,
              outlineColor: '#000',
              borderWeight: 2,
              strokeColor: colors[i % colors.length],
              strokeOpacity: 0.9,
              strokeWeight: 6,
              strokeStyle: 'solid',
              lineJoin: 'round',
              lineCap: 'round',
              zIndex: 50
            });

            mapRef.current.add(polyline);
            routeLinesRef.current.push(polyline);
          }
          // 少量物理延时防抖，保护 API 频次
          setTimeout(resolve, 250);
        });
      });
    }

    const distText = totalDist > 1000 ? (totalDist / 1000).toFixed(1) + 'km' : totalDist + 'm';
    const timeText = Math.ceil(totalDuration / 60) + '分钟';
    setRouteInfo({ distance: distText, duration: timeText });

    // 视角缩放适应
    if (mapRef.current && routeLinesRef.current.length > 0) {
      mapRef.current.setFitView(routeLinesRef.current, false, [60, 60, 320, 60]);
    }
  };

  useEffect(() => {
    if (!plan) return;
    let mapInstance: any = null;

    const initMap = async () => {
      try {
        const container = document.getElementById('amap-container');
        if (container) container.style.backgroundColor = '#111111';

        (window as any)._AMapSecurityConfig = {
          securityJsCode: import.meta.env.VITE_AMAP_SECURITY_JS_CODE
        };

        const AMap = await AMapLoader.load({
          key: import.meta.env.VITE_AMAP_KEY,
          version: '2.0',
          plugins: ['AMap.Geolocation', 'AMap.Walking']
        });

        // 默认定位为第1站
        const firstPoi = plan.itinerary[0].poi;
        mapInstance = new AMap.Map('amap-container', {
          zoom: 14,
          center: firstPoi.location,
          mapStyle: 'amap://styles/dark',
          viewMode: '2D'
        });

        mapRef.current = mapInstance;

        // 1. 批量绘制 timeline 多站点 Marker
        plan.itinerary.forEach((event, idx) => {
          const markerContent = document.createElement('div');
          
          // Leg 节点配色
          const bgColors = ['#e2b553', '#4ca3f5', '#ff5e5e', '#3cd070'];
          const bgColor = bgColors[idx % bgColors.length];

          markerContent.innerHTML = `
            <div style="width: 32px; height: 32px; background: ${bgColor}; border: 2px solid #000; color: #000; font-weight: 900; display: flex; align-items: center; justify-content: center; font-size: 15px; box-shadow: 4px 4px 0 rgba(0,0,0,0.5); font-family: var(--font-mono);">
              ${idx + 1}
            </div>
          `;

          const marker = new AMap.Marker({
            position: event.poi.location,
            content: markerContent,
            offset: new AMap.Pixel(-16, -16),
            zIndex: 100
          });

          // 点击 Marker 可以直接切换底部查看卡片
          marker.on('click', () => {
            setActiveStopIndex(idx);
            mapInstance.setCenter(event.poi.location);
          });

          mapInstance.add(marker);
        });

        // 2. 初始化导航系统
        walkingRef.current = new AMap.Walking({ map: null, hideMarkers: true });

        // 3. 定位系统
        const geolocation = new AMap.Geolocation({
          enableHighAccuracy: true,
          timeout: 8000,
          buttonPosition: 'RB',
          buttonOffset: new AMap.Pixel(16, 260),
          showMarker: true,
          markerOptions: {
            content: `
              <div style="width: 20px; height: 20px; background: #fff; border: 2px solid #000; box-shadow: 2px 2px 0 #3366ff; display: flex; align-items: center; justify-content: center; font-size: 10px;">
                🤠
              </div>
            `,
            offset: new AMap.Pixel(-10, -10)
          },
          showCircle: false
        });
        mapInstance.addControl(geolocation);

        geolocation.on('complete', (data: any) => {
          if (data.position) {
            planMultiStopRoute([data.position.lng, data.position.lat]);
          }
        });

        // 静默发起初次定位抓取
        geolocation.getCurrentPosition();
        isMapLoaded.current = true;

      } catch (err) {
        console.error('Map init error:', err);
      }
    };

    initMap();
    return () => {
      if (mapInstance) mapInstance.destroy();
    };
  }, [plan]);

  if (!plan) return null;

  const activeEvent = plan.itinerary[activeStopIndex];

  // 翻页查看目的地 Leg
  const handlePrevStop = () => {
    setActiveStopIndex((prev) => {
      const next = prev === 0 ? plan.itinerary.length - 1 : prev - 1;
      mapRef.current?.setCenter(plan.itinerary[next].poi.location);
      return next;
    });
  };

  const handleNextStop = () => {
    setActiveStopIndex((prev) => {
      const next = prev === plan.itinerary.length - 1 ? 0 : prev + 1;
      mapRef.current?.setCenter(plan.itinerary[next].poi.location);
      return next;
    });
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden' }}>
      
      {/* 1. 地图渲染容器 */}
      <div id="amap-container" style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />

      {/* 2. 顶部时空元数据悬浮条 */}
      <div style={{ position: 'absolute', top: '30px', left: '20px', right: '20px', zIndex: 100 }}>
        <div className="pixel-panel" style={{ padding: '12px 16px', background: 'rgba(22,20,18,0.92)', border: '2px solid var(--primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Compass size={16} color="var(--primary)" className="spinner-icon" style={{ animation: 'spin 6s linear infinite' }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#fff' }}>命定结界轨迹开启</span>
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--primary)' }}>
            {routeInfo ? `🏃 连线总长: ${routeInfo.distance} (${routeInfo.duration})` : '📡 定位并匹配星轨连线中...'}
          </div>
        </div>
      </div>

      {/* 3. 底部 Leg 详情巡查卡片舱 */}
      <div style={{ position: 'absolute', bottom: '100px', left: '20px', right: '20px', zIndex: 100 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeEvent.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="pixel-panel"
            style={{ padding: '20px', background: 'rgba(22,20,18,0.95)', border: '2px solid var(--pixel-border-color)' }}
          >
            {/* 切页控制器 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <button 
                onClick={handlePrevStop}
                style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '0.7rem' }}
              >
                <ChevronLeft size={16} /> 上一站点
              </button>
              <span className="font-mystic" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '2px 10px' }}>
                站点 {activeStopIndex + 1} / {plan.itinerary.length}
              </span>
              <button 
                onClick={handleNextStop}
                style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '0.7rem' }}
              >
                下一站点 <ChevronRight size={16} />
              </button>
            </div>

            {/* 当前站点 POI 信息 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <div>
                <span style={{ fontSize: '0.6rem', color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>{activeEvent.timeSlot}</span>
                <h3 className="font-mystic" style={{ color: '#fff', fontSize: '1rem', margin: '2px 0 0 0' }}>{activeEvent.poi.name}</h3>
              </div>
              <span style={{ background: 'var(--primary)', color: '#000', fontSize: '0.55rem', fontWeight: 'bold', padding: '2px 6px' }}>
                {activeEvent.activityName}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '10px', fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              <span>★ {activeEvent.poi.rating}</span>
              <span>·</span>
              <span>{activeEvent.poi.type.split(';')[0]}</span>
              <span>·</span>
              <span>距您约 {activeEvent.poi.distance}m</span>
            </div>

            <p style={{ fontSize: '0.7rem', color: 'var(--text-primary)', lineHeight: '1.4', background: 'rgba(0,0,0,0.3)', padding: '10px', borderLeft: '2px solid var(--primary)', margin: 0 }}>
              {activeEvent.mysticReasoning}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

    </div>
  );
};
