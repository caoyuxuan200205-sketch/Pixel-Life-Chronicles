import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Bike, ChevronRight, Download, Info, Map, MapPin, Navigation, Orbit, Palette, PhoneCall, QrCode, RefreshCw, Share2, ShieldCheck, ShoppingBag, Sparkles, UserRound, Wand2 } from 'lucide-react';
import AMapLoader from '@amap/amap-jsapi-loader';
import html2canvas from 'html2canvas';
import { track } from "@vercel/analytics";
import {
  getLatestJointPlan,
  saveJointPlan,
  type JointPlanResult,
  type ActivityEvent
} from '../store';

export const PlanResultPage = () => {
  const navigate = useNavigate();
  const [plan, setPlan] = useState<JointPlanResult | null>(null);

  // 记录本地翻牌状态
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});

  // 记录分享卡弹窗显示状态
  const [showShareModal, setShowShareModal] = useState(false);

  // 记录长图分享状态
  const [isCapturing, setIsCapturing] = useState(false);
  const [shareImgUrl, setShareImgUrl] = useState<string | null>(null);
  const [showShareImgModal, setShowShareImgModal] = useState(false);
  const [captureProgress, setCaptureProgress] = useState('');

  // 记录预订状态和加载状态
  const [bookingLoading, setBookingLoading] = useState<Record<string, boolean>>({});
  const [bookingLoadingMsg, setBookingLoadingMsg] = useState<Record<string, string>>({});
  const [successToast, setSuccessToast] = useState<string | null>(null);

  useEffect(() => {
    const latestPlan = getLatestJointPlan();
    if (!latestPlan) {
      navigate('/', { replace: true });
      return;
    }
    setPlan(latestPlan);
    track('agent_plan_result_view');
  }, [navigate]);

  const itineraryWithIndices = useMemo(() => {
    if (!plan) return [];
    let poiCounter = 0;
    return plan.itinerary.map(event => {
      const isTransit = event.poi?.type?.includes('时空流转') || event.poi?.type?.includes('交通出行') || String(event.activityName).includes('时空流转');
      return {
        ...event,
        isTransit,
        poiIndex: isTransit ? -1 : ++poiCounter
      };
    });
  }, [plan]);

  // 微地图生命周期
  useEffect(() => {
    if (!plan) return;

    let mapInstance: any = null;

    const initMiniMap = async () => {
      try {
        (window as any)._AMapSecurityConfig = {
          securityJsCode: import.meta.env.VITE_AMAP_SECURITY_JS_CODE
        };

        const AMap = await AMapLoader.load({
          key: import.meta.env.VITE_AMAP_KEY,
          version: '2.0',
          plugins: []
        });

        const coordinates = plan.itinerary
          .filter(item => item.poi && item.poi.type !== '交通出行;时空流转')
          .map(item => item.poi.location) as [number, number][];
        if (coordinates.length === 0) return;

        const avgLng = coordinates.reduce((sum, c) => sum + c[0], 0) / coordinates.length;
        const avgLat = coordinates.reduce((sum, c) => sum + c[1], 0) / coordinates.length;

        mapInstance = new AMap.Map('covenant-mini-map', {
          zoom: 13,
          center: [avgLng, avgLat],
          theme: 'dark',
          mapStyle: 'amap://styles/dark',
          dragEnable: true,
          zoomEnable: true,
          WebGLParams: {
            preserveDrawingBuffer: true
          }
        });

        coordinates.forEach((coord, idx) => {
          const marker = new AMap.Marker({
            position: coord,
            content: `<div style="
              width: 20px;
              height: 20px;
              border-radius: 50%;
              background: var(--primary);
              color: #000;
              font-family: var(--font-mystic);
              font-size: 0.65rem;
              font-weight: bold;
              display: flex;
              align-items: center;
              justify-content: center;
              border: 2px solid #fff;
              box-shadow: 0 0 6px var(--primary-glow);
            ">${idx + 1}</div>`,
            anchor: 'center'
          });
          mapInstance.add(marker);
        });

        const polyline = new AMap.Polyline({
          path: coordinates,
          strokeColor: '#e2b553',
          strokeOpacity: 0.8,
          strokeWeight: 4,
          strokeStyle: 'dashed',
          lineJoin: 'round'
        });
        mapInstance.add(polyline);

        mapInstance.setFitView([polyline], false, [20, 20, 20, 20]);

      } catch (e) {
        console.error('Failed to load mini map:', e);
      }
    };

    const timer = setTimeout(() => {
      initMiniMap();
    }, 400);

    return () => {
      clearTimeout(timer);
      if (mapInstance) {
        mapInstance.destroy();
      }
    };
  }, [plan]);

  if (!plan) return null;

  // 触发卡牌翻转
  const toggleCard = (memberId: string) => {
    setFlippedCards(prev => ({
      ...prev,
      [memberId]: !prev[memberId]
    }));
    track('agent_click_flip_tarot', { member_id: memberId });
  };

  // 执行一键预约
  const handleBooking = async (eventId: string, bookingType: 'didi' | 'coupon' | 'ticket') => {
    setBookingLoading(prev => ({ ...prev, [eventId]: true }));

    // 模拟不同环节的时空调用进度跑马灯
    const msgs = {
      didi: ['📡 正在定位当前时空信标...', '🚗 唤醒高德专车调度系统...', '🚕 匹配最近的像素专车司机...'],
      ticket: ['🛍️ 正在与美团同城闪购商家通信...', '📦 锁定周边手作材料库存...', '🎟️ 购买时空门票中...'],
      coupon: ['🎁 检索商户卡包网络...', '🎟️ 注入平台满减补贴...', '💰 绑定优惠到手机号...']
    }[bookingType];

    setBookingLoadingMsg(prev => ({ ...prev, [eventId]: msgs[0] }));

    // 模拟步骤轮播
    setTimeout(() => {
      setBookingLoadingMsg(prev => ({ ...prev, [eventId]: msgs[1] }));
    }, 800);
    setTimeout(() => {
      setBookingLoadingMsg(prev => ({ ...prev, [eventId]: msgs[2] }));
    }, 1600);

    setTimeout(async () => {
      try {
        const baseUrl = import.meta.env.VITE_BACKEND_URL || window.location.origin;
        const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/agent/book`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            planId: plan.id,
            eventId,
            bookingType
          })
        });

        const data = await res.json();
        if (data.success) {
          // 更新本地 store 状态
          const updatedItinerary = plan.itinerary.map((event) => {
            if (event.id === eventId && event.bookingStatus) {
              return {
                ...event,
                bookingStatus: {
                  ...event.bookingStatus,
                  status: 'success' as const,
                  detail: data.detail
                }
              };
            }
            return event;
          });

          const newPlan = { ...plan, itinerary: updatedItinerary };
          saveJointPlan(newPlan);
          setPlan(newPlan);

          // 播放全局吐司成功通知
          setSuccessToast(data.detail);
          setTimeout(() => setSuccessToast(null), 5000);

          track('agent_booking_success', { event_id: eventId, type: bookingType });
        }
      } catch (err) {
        console.error(err);
        alert('预订感应中断，请重新尝试。');
      } finally {
        setBookingLoading(prev => ({ ...prev, [eventId]: false }));
      }
    }, 2400);
  };

  // 一键生成整个页面的长图分享
  const handleShareLongImage = async () => {
    setIsCapturing(true);
    setCaptureProgress('🔮 正在唤醒时空画卷编织器...');
    track('plan_result_click_share_long_image');

    // 延时等待状态更新，以隐藏不需要被截图的元素，并展现生成专用的页脚
    setTimeout(async () => {
      try {
        const shareElement = document.getElementById('share-page-root');
        if (!shareElement) {
          throw new Error('未找到分享页面根元素');
        }

        setCaptureProgress('🖼️ 正在捕捉结界信标与命盘...');

        // 渲染成 Canvas，设置 scale 为 2 以确保超高清像素画画风不模糊
        const canvas = await html2canvas(shareElement, {
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#0d0b0a', // 保持暗黑底色
          scale: 2,
          scrollX: 0,
          scrollY: 0,
          windowWidth: shareElement.scrollWidth,
          windowHeight: shareElement.scrollHeight
        });

        setCaptureProgress('✨ 正在凝聚命运契约长图...');
        const imgUrl = canvas.toDataURL('image/png');
        setShareImgUrl(imgUrl);
        setShowShareImgModal(true);
      } catch (err) {
        console.error('Failed to generate long image:', err);
        alert('编织时空长图失败，请尝试直接手机截图分享。');
      } finally {
        setIsCapturing(false);
        setCaptureProgress('');
      }
    }, 300);
  };

  return (
    <>
      <div
        id="share-page-root"
        style={{
          padding: '24px 20px 100px 20px',
          minHeight: '100vh',
          background: 'var(--app-journey-background)',
          color: '#fff',
          position: 'relative'
        }}
      >
        <div className="xuantu-brand-lockup xuantu-page-brand">
          <span className="xuantu-brand-mark" aria-hidden="true"><Orbit size={20} /></span>
          <span>玄途 Agent</span>
        </div>


        {/* 顶部契约文书 scroll layout */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--primary)', border: '1px solid var(--primary)', padding: '2px 8px', letterSpacing: '0.1em' }}>
            XUANTU AGENT · ITINERARY
          </span>
          <h2 className="font-mystic" style={{ color: 'var(--primary)', margin: '8px 0', fontSize: '1.5rem' }}>
            玄途为你规划的今日行程
          </h2>
          <p className="xuantu-result-subtitle">玄学推演 · 真实地点 · 可执行路线</p>

        </div>

        {/* 判词 - 无框，直接展示在背景上，大号斜体 */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            marginBottom: '24px',
            padding: '0 8px',
            position: 'relative'
          }}
        >
          <p className="font-mystic" style={{
            fontSize: '0.9rem',
            color: '#e6ded4',
            lineHeight: '1.8',
            textAlign: 'justify',
            fontStyle: 'italic',
            letterSpacing: '0.05em',
            textIndent: '2em',
            margin: 0
          }}>
            “{plan.divinationSynthesis}”
          </p>
        </motion.div>

        {/* 🧭 微缩时空地图 - 无外框，仅地图本身有精致金框 */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: '32px', padding: '0 8px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Map size={15} /> 行程路线预览
            </span>
            <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>共 {plan.itinerary.length} 个行程节点</span>
          </div>

          <div
            id="covenant-mini-map"
            style={{
              width: '100%',
              height: '160px',
              background: '#1c1714',
              position: 'relative',
              border: '2px solid var(--primary)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
              borderRadius: '2px'
            }}
          />
        </motion.div>

      {/* 核心 Timeline 时空行程安排 */}
      <h3 className="font-mystic" style={{ color: '#fff', fontSize: '1.1rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Navigation size={18} /> 为你安排的行程
      </h3>

      <div style={{ position: 'relative', paddingLeft: '24px', borderLeft: '2px dashed var(--pixel-border-color)', marginLeft: '12px', display: 'flex', flexDirection: 'column', gap: '32px', marginBottom: '40px' }}>
        {itineraryWithIndices.map((event, idx) => {
          const { isTransit, poiIndex } = event;
          const poiCounter = poiIndex;
          return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.15 }}
                style={{ position: 'relative' }}
              >
                {/* 时间轴左侧的小圆圈 */}
                <div style={{
                  position: 'absolute',
                  left: '-33px',
                  top: '4px',
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: isTransit ? 'rgba(255,255,255,0.1)' : 'var(--primary)',
                  border: isTransit ? '2px dashed var(--primary)' : '3px solid var(--bg-dark)',
                  boxShadow: isTransit ? 'none' : '0 0 8px var(--primary-glow)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.55rem',
                  color: isTransit ? 'var(--primary)' : '#000',
                  fontWeight: 'bold'
                }}>
                  {isTransit ? <Bike size={15} /> : poiCounter}
                </div>

                {isTransit ? (
                  /* 交通/时空流转卡片 */
                  <div
                    className="pixel-panel"
                    style={{
                      padding: '12px 16px',
                      background: 'rgba(255,255,255,0.02)',
                      borderStyle: 'dashed',
                      borderColor: 'rgba(226, 181, 83, 0.2)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>{event.timeSlot}</span>
                      <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>时空流转</span>
                    </div>
                    <h4 style={{ color: '#fff', fontSize: '0.9rem', margin: '4px 0 0 0' }} className="font-mystic">{event.activityName}</h4>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: '6px 0 0 0', lineHeight: '1.4', textAlign: 'left' }}>
                      {event.mysticReasoning}
                    </p>
                  </div>
                ) : (
                  /* 活动卡片 */
                  <div className="pixel-panel" style={{ padding: '20px', background: 'var(--bg-card)' }}>
                    {/* 卡片头部 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <span style={{ fontSize: '0.65rem', color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>{event.timeSlot}</span>
                        <h4 style={{ color: '#fff', fontSize: '1rem', margin: '4px 0 0 0' }} className="font-mystic">{event.activityName}</h4>
                      </div>
                      <span style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', padding: '2px 8px', fontSize: '0.6rem' }}>
                        {event.poi?.type?.split(';')[0] || '特色商户'}
                      </span>
                    </div>

                    {/* 高德商户详情 */}
                    {event.poi && (
                      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 'bold' }}>
                          <span style={{ color: 'var(--text-primary)' }}><MapPin size={13} /> {event.poi.name}</span>
                          <span style={{ color: 'var(--primary)' }}>★ {event.poi.rating}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                          <span>{event.poi.address}</span>
                          <span>距起点 {event.poi.distance}m</span>
                        </div>
                      </div>
                    )}

                    {/* 命运契合度说明 */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', padding: '10px', background: 'var(--primary-dim)', border: '1px solid rgba(226, 181, 83, 0.1)' }}>
                      <Sparkles size={14} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                        {event.mysticReasoning}
                      </p>
                    </div>

                    {/* 预约处理面板 (Tool Calling 展示) */}
                    {event.bookingStatus && (
                      <div className="pixel-panel" style={{ padding: '12px', background: 'rgba(0,0,0,0.4)', borderStyle: 'dashed' }}>
                        {event.bookingStatus.status === 'pending' ? (
                          // 待预订状态
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                              <Wand2 size={13} /> 时空 Agent 建议执行工具：<span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{event.bookingStatus.name}</span>
                            </div>
                            <button
                              className="btn btn-primary"
                              disabled={bookingLoading[event.id]}
                              onClick={() => handleBooking(event.id, event.bookingStatus!.type as any)}
                              style={{
                                width: '100%',
                                fontSize: '0.75rem',
                                padding: '10px',
                                background: 'linear-gradient(45deg, #e2b553, #b28a2a)',
                                border: 'none',
                                color: '#000',
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px'
                              }}
                            >
                              {bookingLoading[event.id] ? (
                                <>
                                  <RefreshCw size={12} className="spinner-icon" style={{ animation: 'spin 1.5s linear infinite' }} />
                                  <span>{bookingLoadingMsg[event.id]}</span>
                                </>
                              ) : (
                                <>
                                  <PhoneCall size={12} />
                                  <span>一键命定预订 (Call Tool)</span>
                                </>
                              )}
                            </button>
                          </div>
                        ) : (
                          // 预订成功状态
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <ShieldCheck size={16} color="#3CD070" style={{ flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '0.75rem', color: '#3CD070', fontWeight: 'bold' }}>工具自动履行成功 (Success)</div>
                              <div style={{ fontSize: '0.65rem', color: 'var(--text-primary)', marginTop: '2px' }}>{event.bookingStatus.detail}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
            </motion.div>
          );
        })}
      </div>

      {/* 命运结界命盘解读大厅 */}
      <h3 className="font-mystic" style={{ color: '#fff', fontSize: '1.1rem', marginBottom: '20px' }}>
        <Orbit size={18} /> 这条路线为什么适合你
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', marginBottom: '40px' }}>
        {plan.individualReadings.map((reading) => {
          const member = plan.members.find(m => m.id === reading.memberId);
          if (!member) return null;

          const isTarot = member.divinationMethod === 'tarot';

          return (
            <div
              key={reading.memberId}
              className="pixel-panel"
              style={{ padding: '24px 20px', background: 'var(--bg-card)' }}
            >
              {/* 成员头部 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
                <span className="member-avatar"><UserRound size={17} /></span>
                <div>
                  <h4 style={{ color: '#fff', fontSize: '0.9rem', margin: 0 }}>{member.name}</h4>
                  <span style={{ fontSize: '0.6rem', color: 'var(--primary)' }}>
                    {isTarot ? '西方塔罗星命 · 情绪调御' : '东方八字开运 · 命盘契合'}
                  </span>
                </div>
              </div>

              {/* 塔罗 3D 翻牌组件 */}
              {isTarot && (reading.tarotCards || reading.tarotCard) ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%' }}>
                  <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap', width: '100%' }}>
                    {(reading.tarotCards || [reading.tarotCard]).map((card: any, cardPosIdx: number) => {
                      if (!card) return null;
                      const uniqueCardId = `${member.id}_${cardPosIdx}`;
                      const isFlipped = flippedCards[uniqueCardId];
                      const positionLabel = (reading.tarotCards && reading.tarotCards.length === 3)
                        ? ['过去 (出发之意)', '现在 (行中之契)', '未来 (归途之兆)'][cardPosIdx]
                        : '命定开运神谕';

                      return (
                        <div key={cardPosIdx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                          <div
                            onClick={() => {
                              setFlippedCards(prev => ({
                                ...prev,
                                [uniqueCardId]: !prev[uniqueCardId]
                              }));
                            }}
                            style={{
                              width: '110px',
                              height: '180px',
                              perspective: '1000px',
                              cursor: 'pointer',
                              position: 'relative'
                            }}
                          >
                            <motion.div
                              animate={{ rotateY: isFlipped ? 180 : 0 }}
                              transition={{ duration: 0.6, ease: 'easeOut' }}
                              style={{
                                width: '100%',
                                height: '100%',
                                transformStyle: 'preserve-3d',
                                position: 'relative'
                              }}
                            >
                              {/* 牌背 (未翻开) */}
                              <div style={{
                                position: 'absolute',
                                width: '100%',
                                height: '100%',
                                backfaceVisibility: 'hidden',
                                background: 'radial-gradient(circle, #2a221b 0%, #15110e 100%)',
                                border: '2.5px solid var(--primary)',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: '8px',
                                boxShadow: '0 6px 12px rgba(0,0,0,0.5)'
                              }}>
                                <div className="reading-symbol"><Orbit size={18} /></div>
                                <span style={{ fontSize: '0.45rem', color: 'var(--primary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>REVEAL</span>
                              </div>

                              {/* 牌面 (已翻开) */}
                              <div style={{
                                position: 'absolute',
                                width: '100%',
                                height: '100%',
                                backfaceVisibility: 'hidden',
                                transform: 'rotateY(180deg)',
                                background: 'linear-gradient(135deg, #1b1612 0%, #2a221b 100%)',
                                border: '2.5px solid var(--primary)',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '12px 6px',
                                boxShadow: '0 6px 12px rgba(0,0,0,0.5)'
                              }}>
                                <div style={{ fontSize: '0.5rem', color: 'var(--primary)', borderBottom: '1px solid var(--primary)', width: '100%', paddingBottom: '2px', textTransform: 'uppercase', fontWeight: 'bold', fontSize: '0.45rem', textAlign: 'center' }}>
                                  {positionLabel}
                                </div>

                                <div style={{ textAlign: 'center' }}>
                                  <div style={{ fontSize: '2.5rem', margin: '4px 0' }}>{card.emoji}</div>
                                  <div style={{ fontSize: '0.75rem', color: '#fff', fontWeight: 'bold' }} className="font-mystic">
                                    {card.name}
                                  </div>
                                </div>

                                <div style={{ fontSize: '0.45rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: '1.2' }}>
                                  {card.meaning}
                                </div>
                              </div>
                            </motion.div>
                          </div>

                          <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>
                            {isFlipped ? '已翻开' : '点击翻牌'}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* 解读文本 */}
                  <div
                    style={{
                      background: 'rgba(0,0,0,0.3)',
                      padding: '16px',
                      fontSize: '0.75rem',
                      lineHeight: '1.6',
                      color: 'var(--text-primary)',
                      borderLeft: '2px solid var(--primary)',
                      width: '100%',
                      textAlign: 'justify'
                    }}
                  >
                    {reading.readingText}
                  </div>
                </div>
              ) : (
                // 东方生辰八字排盘面板
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                  {/* 八字四柱排盘 */}
                  {reading.baziChart && (
                    <div className="pixel-panel" style={{ padding: '16px', background: 'rgba(0,0,0,0.4)', border: '2px solid #E2B553' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', textAlign: 'center', marginBottom: '16px' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>时柱</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>日柱</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>月柱</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>年柱</div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', textAlign: 'center' }}>
                        {/* 遍历四柱干支 */}
                        {[3, 2, 1, 0].map((idx) => {
                          const pillar = reading.baziChart!.fourPillars[idx];
                          if (!pillar) return null;
                          const stem = pillar[0];
                          const branch = pillar[1];
                          const isDayPillar = idx === 2; // 日柱高亮，日主代表核心运势

                          return (
                            <div
                              key={idx}
                              style={{
                                background: isDayPillar ? 'rgba(226, 181, 83, 0.15)' : 'rgba(255,255,255,0.02)',
                                border: isDayPillar ? '1px solid #E2B553' : '1px solid rgba(255,255,255,0.05)',
                                padding: '10px 4px'
                              }}
                            >
                              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: isDayPillar ? '#E2B553' : '#fff' }}>{stem}</div>
                              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: isDayPillar ? '#E2B553' : '#fff', marginTop: '4px' }}>{branch}</div>
                              {isDayPillar && (
                                <div style={{ fontSize: '0.5rem', background: '#E2B553', color: '#000', padding: '1px 2px', marginTop: '6px', fontWeight: 'bold' }}>
                                  日主
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 五行分布条 */}
                  {reading.baziChart && (
                    <div className="pixel-panel" style={{ padding: '16px', background: 'rgba(0,0,0,0.2)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>五行生克乘侮比例</span>
                        <div style={{ display: 'flex', gap: '6px', fontSize: '0.65rem' }}>
                          <span style={{ color: '#E2B553' }}>幸运五行 ➔</span>
                          <span style={{
                            background: { '金': '#E2B553', '木': '#3CD070', '水': '#4CA3F5', '火': '#FF5E5E', '土': '#A87A54' }[reading.baziChart.luckyElement] || 'var(--primary)',
                            color: '#000',
                            padding: '0 4px',
                            fontWeight: 'bold'
                          }}>
                            {reading.baziChart.luckyElement}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {reading.baziChart.elements.map((el) => (
                          <div key={el.name} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '0.65rem', width: '20px', color: el.color, fontWeight: 'bold' }}>{el.name}</span>
                            <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', height: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                              <div style={{ background: el.color, height: '100%', width: `${el.value}%`, transition: 'width 1s ease' }} />
                            </div>
                            <span style={{ fontSize: '0.6rem', width: '30px', textAlign: 'right', color: 'var(--text-muted)' }}>{el.value}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 八字详细占卜词 */}
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', fontSize: '0.75rem', lineHeight: '1.6', color: 'var(--text-primary)', borderLeft: '2px solid #E2B553' }}>
                    {reading.readingText}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 导航与印鉴二合一交互面板 - 截图时隐藏 */}
      {!isCapturing && (
        <div className="pixel-panel" style={{ padding: '24px 20px', background: 'var(--bg-card)', border: '1px dashed var(--primary)', textAlign: 'center', marginBottom: '32px' }}>
          <h4 className="font-mystic" style={{ color: 'var(--primary)', margin: '0 0 10px 0', fontSize: '1rem' }}>
            <Map size={18} /> 开启时空轨迹导航与命运印鉴
          </h4>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '20px' }}>
            命运结界已开启！现在可以前往“冒险”界面查看全线步行自驾轨迹与像素小人漫步，或者前往“创作”界面生成“命运纪念印章”拼豆图纸存入命格宝箱！
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              className="btn btn-primary"
              onClick={() => {
                track('plan_result_click_go_to_map');
                navigate('/map');
              }}
              style={{
                width: '100%',
                fontSize: '0.85rem',
                padding: '14px',
                background: 'linear-gradient(45deg, #FFD000, #FFA500)',
                border: 'none',
                color: '#000',
                fontWeight: 'bold',
                boxShadow: '0 4px 0 #805c19',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <Navigation size={15} /> 开启“冒险”时空地图导航 <ChevronRight size={14} />
            </button>

            <button
              className="btn btn-ghost"
              onClick={() => {
                track('plan_result_click_create_stamp');
                navigate('/camera');
              }}
              style={{
                width: '100%',
                fontSize: '0.75rem',
                padding: '10px',
                color: 'var(--primary)',
                border: '1px solid var(--primary)',
                background: 'transparent',
                boxShadow: 'none'
              }}
            >
              <Palette size={15} /> 前往创作“命运纪念印章” <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* 一键分享整个页面的长图按钮 - 截图时隐藏 */}
      {!isCapturing && (
        <div style={{ marginBottom: '32px' }}>
          <button
            className="btn btn-primary"
            onClick={handleShareLongImage}
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '0.9rem',
              background: 'linear-gradient(45deg, #FFD000, #FFA500)',
              border: 'none',
              color: '#000',
              fontWeight: 'bold',
              fontFamily: 'var(--font-mystic)',
              boxShadow: '0 4px 0px #805c19',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <Share2 size={16} /> 一键生成“完整行程命运契约分享图卡”
          </button>
        </div>
      )}

      {/* 截图专属精致页脚 - 仅在生成截图时显示 */}
      {isCapturing && (
        <div style={{
          textAlign: 'center',
          marginTop: '40px',
          padding: '24px 20px',
          borderTop: '2px dashed var(--primary)',
          background: 'rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Orbit size={18} />
            <span style={{ fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 'bold', letterSpacing: '0.1em' }} className="font-mystic">
              XUANTU AGENT · ITINERARY · 时空命运契约
            </span>
            <Sparkles size={18} />
          </div>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>
            —— 本契约受时空结界保护，由 Pixel Life Chronicles 命盘信标机签署 ——
          </div>
          <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', marginTop: '8px' }}>
            <QrCode size={14} /> 扫描二维码，开启您与同伴的时空命格旅程
          </div>
        </div>
      )}
      </div>

      {/* 实时预订成功弹出吐司 (Toast notification with micro-animations) - 放在截图区域外 */}
      <AnimatePresence>
        {successToast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            style={{
              position: 'fixed',
              bottom: '100px',
              left: '20px',
              right: '20px',
              zIndex: 9999,
              pointerEvents: 'none',
              display: 'flex',
              justifyContent: 'center'
            }}
          >
            <div className="pixel-panel" style={{
              background: '#3CD070',
              color: '#000',
              padding: '16px 20px',
              fontWeight: 900,
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 10px 30px rgba(60,208,112,0.4)',
              border: '2px solid #000'
            }}>
              <Sparkles size={16} />
              <span>{successToast}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 时空编织长图渲染加载遮罩 - 放在截图区域外 */}
      {captureProgress && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(13, 11, 10, 0.95)',
          zIndex: 20000,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '20px'
        }}>
          <div style={{
            fontSize: '3rem',
            animation: 'spin 2.5s linear infinite'
          }}>
            <Orbit size={30} />
          </div>
          <h3 className="font-mystic" style={{ color: 'var(--primary)', fontSize: '1.2rem' }}>
            {captureProgress}
          </h3>
          <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
            时空涟漪凝聚中，请勿触摸或滚动屏幕...
          </p>
        </div>
      )}

      {/* 命运契约超高清长图分享弹窗 - 放在截图区域外 */}
      <AnimatePresence>
        {showShareImgModal && shareImgUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(13, 11, 10, 0.95)',
              zIndex: 21000,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'center',
              overflowY: 'auto',
              padding: '24px 16px'
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '16px', maxWidth: '340px' }}>
              <h3 className="font-mystic" style={{ color: 'var(--primary)', fontSize: '1.25rem', marginBottom: '8px' }}>
                命运契约画卷编织完成
              </h3>
              <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                <Info size={14} /> <b>长按下方图片</b>即可保存到相册，或直接发送给同行伙伴
              </p>
            </div>

            {/* 图片预览容器，设置宽度，保持长图原始比例 */}
            <div
              className="pixel-panel"
              style={{
                width: '100%',
                maxWidth: '320px',
                background: '#0d0b0a',
                border: '3px solid var(--primary)',
                boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
                marginBottom: '24px',
                overflow: 'hidden'
              }}
            >
              <img
                src={shareImgUrl}
                alt="Chrono Covenant Long Share"
                style={{
                  width: '100%',
                  display: 'block',
                  userSelect: 'auto', // 关键！确保用户长按可以保存！
                  WebkitUserSelect: 'auto'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '320px', marginBottom: '32px' }}>
              <a
                href={shareImgUrl}
                download={`chrono-covenant-${plan.id.slice(0,6)}.png`}
                className="btn btn-primary"
                style={{
                  padding: '12px',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  textDecoration: 'none',
                  color: '#000'
                }}
              >
                <Download size={16} /> 下载高清长图
              </a>

              <button
                className="btn btn-ghost"
                onClick={() => {
                  setShowShareImgModal(false);
                  setShareImgUrl(null);
                }}
                style={{
                  padding: '10px',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)'
                }}
              >
                返回契约之境
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 命运契约分享图卡模态弹窗 - 原简化版作为备用 - 放在截图区域外 */}
      <AnimatePresence>
        {showShareModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.85)',
              zIndex: 10000,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '20px'
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="pixel-panel"
              style={{
                width: '100%',
                maxWidth: '340px',
                background: 'linear-gradient(135deg, #f5ecd7 0%, #e2d1ad 100%)',
                color: '#2a221b',
                padding: '24px 20px',
                border: '3px solid #b28a2a',
                boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
                textAlign: 'center',
                position: 'relative'
              }}
            >
              <div style={{ position: 'absolute', top: '6px', left: '6px', fontSize: '0.8rem', color: '#b28a2a' }}>✦</div>
              <div style={{ position: 'absolute', top: '6px', right: '6px', fontSize: '0.8rem', color: '#b28a2a' }}>✦</div>
              <div style={{ position: 'absolute', bottom: '6px', left: '6px', fontSize: '0.8rem', color: '#b28a2a' }}>✦</div>
              <div style={{ position: 'absolute', bottom: '6px', right: '6px', fontSize: '0.8rem', color: '#b28a2a' }}>✦</div>

              <div style={{ borderBottom: '1px dashed #b28a2a', paddingBottom: '12px', marginBottom: '16px' }}>
                <span style={{ fontSize: '0.55rem', background: '#2a221b', color: '#fff', padding: '2px 8px', letterSpacing: '0.1em' }}>
                  CHRONO-DESTINY COVENANT
                </span>
                <h3 className="font-mystic" style={{ margin: '8px 0 2px 0', fontSize: '1.25rem', color: '#17120e' }}>
                  时空命格结界 · 契约书
                </h3>
                <span style={{ fontSize: '0.55rem', color: '#6d5334' }}>
                  生成时间: {new Date(plan.createdAt).toLocaleDateString()}
                </span>
              </div>

              <div style={{ textAlign: 'left', background: 'rgba(255,255,255,0.4)', padding: '12px', border: '1px solid rgba(178,138,42,0.3)', marginBottom: '16px' }}>
                <div style={{ fontSize: '0.6rem', color: '#8a6537', fontWeight: 'bold', marginBottom: '4px' }}>🔮 命运综述：</div>
                <p style={{ fontSize: '0.7rem', color: '#2a221b', lineHeight: '1.5', margin: 0, fontStyle: 'italic' }}>
                  “{plan.divinationSynthesis}”
                </p>
              </div>

              <div style={{ textAlign: 'left', marginBottom: '16px' }}>
                <div style={{ fontSize: '0.6rem', color: '#8a6537', fontWeight: 'bold', marginBottom: '8px' }}>🗺️ 探索行进信标：</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {plan.itinerary.map((event, i) => (
                    <div key={event.id} style={{ display: 'flex', gap: '8px', fontSize: '0.65rem', alignItems: 'center' }}>
                      <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#2a221b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.5rem', fontWeight: 'bold', flexShrink: 0 }}>
                        {i + 1}
                      </span>
                      <div style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <b style={{ color: '#17120e' }}>{event.activityName}</b> | {event.poi.name}
                      </div>
                      <span style={{ color: '#8a6537', fontSize: '0.55rem' }}>{event.timeSlot.split(' ')[0]}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', borderTop: '1px dashed #b28a2a', paddingTop: '12px', marginBottom: '12px' }}>
                {plan.members.map((m) => (
                  <span key={m.id} style={{ fontSize: '0.6rem', background: '#2a221b', color: '#fff', padding: '2px 8px', borderRadius: '2px' }}>
                    🧙‍♂️ {m.name}
                  </span>
                ))}
              </div>

              <div style={{ fontSize: '0.5rem', color: '#6d5334', marginTop: '16px' }}>
                —— ☯️ 扫码或访问 Pixel Life Chronicles 开启宿命命盘 ——
              </div>
            </motion.div>

            <div style={{ marginTop: '20px', textAlign: 'center', maxWidth: '300px' }}>
              <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)', lineHeight: '1.4', marginBottom: '12px' }}>
                💡 命运契约分享图卡已编织完毕。<br />长按图片可保存发送，或直接<b>截图分享</b>给您的结界伴侣！
              </p>
              <button
                className="btn btn-primary"
                onClick={() => setShowShareModal(false)}
                style={{
                  padding: '10px 24px',
                  background: 'linear-gradient(45deg, #e2b553, #b28a2a)',
                  border: 'none',
                  color: '#000',
                  fontWeight: 'bold',
                  fontSize: '0.75rem',
                  boxShadow: 'none'
                }}
              >
                关闭契约图卡
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
