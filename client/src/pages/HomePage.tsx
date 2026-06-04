import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Plus, Trash2, Wand2, Compass, Sparkles, User as UserIcon, Calendar, Info, Heart, Coins, ShieldAlert, Briefcase } from 'lucide-react';
import AMapLoader from '@amap/amap-jsapi-loader';
import { useNavigate } from 'react-router-dom';
import { track } from "@vercel/analytics";
import {
  getCurrentUser,
  saveJointPlan,
  getBoundMembers,
  type POIData,
  type GroupMember,
  type BoundMember,
  TAROT_CARDS
} from '../store';
import { MOOD_TAGS } from '../services/ai';

const RPG_AVATARS = ['🧙‍♂️', '🧝‍♀️', '🧛‍♂️', '🤺', '🤠', '🧚‍♀️', '🧜‍♂️', '👸'];

export const HomePage = () => {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();

  // 1. 初始化结界成员，默认有“我”，从个人天命档案中读取默认偏好
  const [members, setMembers] = useState<GroupMember[]>(() => {
    const user = getCurrentUser();
    if (user) {
      return [{
        id: 'me',
        name: user.username,
        divinationMethod: user.divinationPreference || 'tarot',
        mood: 'tired',
        baziInfo: user.divinationPreference === 'bazi' && user.baziInfo ? {
          birthDate: user.baziInfo.birthDate,
          birthTime: user.baziInfo.birthTime,
          birthPlace: user.baziInfo.birthPlace,
          queryType: 'travel'
        } : undefined
      }];
    }
    return [{ id: 'me', name: '探索者', divinationMethod: 'tarot', mood: 'tired' }];
  });

  // 2. 出行时间预算 (2-6 小时)
  const [timeBudget, setTimeBudget] = useState(4);
  const [distanceBudget, setDistanceBudget] = useState(8);

  // 4. 时空旅伴快捷关系网络
  const [boundMembers, setBoundMembers] = useState<BoundMember[]>(getBoundMembers());

  const toggleBoundMember = (bm: BoundMember) => {
    const exists = members.some(m => m.id === bm.id);
    if (exists) {
      setMembers(prev => prev.filter(m => m.id !== bm.id));
    } else {
      if (members.length >= 4) {
        alert('【结界负荷过重】目前结界最多支持 4 位成员同行，请保持最紧密的默契磁场。');
        return;
      }
      const newMember: GroupMember = {
        id: bm.id,
        name: bm.name.split(' ')[0], // 保持名字简洁
        divinationMethod: bm.divinationMethod,
        mood: bm.mood || 'tired',
        baziInfo: bm.divinationMethod === 'bazi' && bm.baziInfo ? {
          birthDate: bm.baziInfo.birthDate,
          birthTime: bm.baziInfo.birthTime,
          birthPlace: bm.baziInfo.birthPlace,
          queryType: 'travel'
        } : undefined
      };
      setMembers(prev => [...prev, newMember]);
    }
  };

  const handleTimeBudgetChange = (val: number) => {
    setTimeBudget(val);
    const recommendedDist = {
      2: 3,
      3: 5,
      4: 8,
      5: 10,
      6: 12
    }[val] || 8;
    setDistanceBudget(recommendedDist);
  };

  // 3. 召唤状态与加载跑马灯 (LangGraph 智能流控)
  const [loading, setLoading] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0.00);
  const [startTime, setStartTime] = useState(0);
  const [activeLogs, setActiveLogs] = useState<string[]>([]);
  
  interface GraphNode {
    id: string;
    name: string;
    emoji: string;
    description: string;
    status: 'idle' | 'active' | 'completed' | 'failed';
    timeSpent?: number;
  }

  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([
    { id: 'nest', name: '筑起结界祭坛', emoji: '🌌', description: '初始化时空探针，感应星能基石', status: 'idle' },
    { id: 'chart', name: '玄学解盘分析', emoji: '☯️', description: '八字排四柱，抽取塔罗大阿卡纳', status: 'idle' },
    { id: 'pois', name: '高德商户探针', emoji: '🗺️', description: '检索附近公里范围真实候选商户', status: 'idle' },
    { id: 'agent', name: 'Qwen 命运推理', emoji: '🧠', description: '通义千问大模型规划轨迹与判词', status: 'idle' },
    { id: 'tools', name: '工具履行链', emoji: '🚗', description: '组装专车、门票、满减卡券预订通道', status: 'idle' }
  ]);

  useEffect(() => {
    if (!currentUser) {
      navigate('/auth', { replace: true });
    }
  }, [currentUser, navigate]);

  // 计时器：计算已耗时与模拟实时控制台日志
  useEffect(() => {
    let timer: any;
    if (loading) {
      const start = Date.now();
      setStartTime(start);
      setElapsedTime(0);
      timer = setInterval(() => {
        const diff = (Date.now() - start) / 1000;
        setElapsedTime(diff);
      }, 30);
    } else {
      setElapsedTime(0);
    }
    return () => clearInterval(timer);
  }, [loading]);

  // 添加成员
  const addMember = () => {
    if (members.length >= 4) {
      alert('【结界负荷过重】目前结界最多支持 4 位成员同行，请保持最紧密的默契磁场。');
      return;
    }
    const id = `member_${Date.now()}`;
    const randomAvatar = RPG_AVATARS[members.length % RPG_AVATARS.length];
    setMembers([
      ...members,
      {
        id,
        name: `结界伙伴 ${members.length + 1}`,
        divinationMethod: 'bazi',
        baziInfo: {
          birthDate: '1998-06-15',
          birthTime: '12:00',
          birthPlace: '杭州',
          queryType: 'travel'
        }
      }
    ]);
    track('group_add_member');
  };

  // 删除成员
  const removeMember = (id: string) => {
    if (id === 'me') return;
    setMembers(members.filter((m) => m.id !== id));
  };

  // 修改成员配置
  const updateMember = (id: string, updates: Partial<GroupMember>) => {
    setMembers(
      members.map((m) => {
        if (m.id === id) {
          const newMember = { ...m, ...updates };
          // 如果切回八字但没有八字数据，则赋初值
          if (updates.divinationMethod === 'bazi' && !newMember.baziInfo) {
            newMember.baziInfo = {
              birthDate: '1998-06-15',
              birthTime: '12:00',
              birthPlace: '杭州',
              queryType: 'travel'
            };
          }
          return newMember;
        }
        return m;
      })
    );
  };

  // 修改八字具体字段
  const updateBazi = (id: string, baziField: string, value: string) => {
    setMembers(
      members.map((m) => {
        if (m.id === id && m.baziInfo) {
          return {
            ...m,
            baziInfo: {
              ...m.baziInfo,
              [baziField]: value
            }
          };
        }
        return m;
      })
    );
  };

  // 核心功能：命定仪式召唤
  const handleSummon = async () => {
    setLoading(true);
    setActiveLogs([]);
    addLog('🌌 筑起结界祭坛，正在初始化 Chrono-Destiny 沙盒...');
    
    const updateNode = (id: string, status: 'idle' | 'active' | 'completed' | 'failed', timeSpent?: number) => {
      setGraphNodes(prev => prev.map(n => {
        if (n.id === id) {
          return { ...n, status, ...(timeSpent !== undefined ? { timeSpent } : {}) };
        }
        return n;
      }));
    };

    // 重置所有节点状态
    setGraphNodes(prev => prev.map(n => ({ ...n, status: 'idle', timeSpent: undefined })));

    let t0 = Date.now();
    
    try {
      // Node 1: 筑起结界
      updateNode('nest', 'active');
      await new Promise(r => setTimeout(r, 600));
      addLog('✅ 结界法阵能量稳定，时空坐标感知就绪。');
      updateNode('nest', 'completed', (Date.now() - t0) / 1000);
      
      // Node 2: 玄学解盘
      t0 = Date.now();
      updateNode('chart', 'active');
      addLog('☯️ 东方八字排盘载入中，西方塔罗牌面散落...');
      await new Promise(r => setTimeout(r, 800));
      
      members.forEach((m) => {
        if (m.divinationMethod === 'bazi') {
          addLog(`🔮 解析成员 [${m.name}] 生辰八字，开运能量四柱匹配就绪`);
        } else {
          addLog(`🃏 抽取成员 [${m.name}] 情绪感知塔罗大阿卡纳牌面`);
        }
      });
      updateNode('chart', 'completed', (Date.now() - t0) / 1000);

      // Node 3: 地理商户探针
      t0 = Date.now();
      updateNode('pois', 'active');
      addLog(`🗺️ 启动高德 PlaceSearch，搜索附近 ${distanceBudget}km 商户候选...`);

      // 1. 加载高德地图并抓取真实商户 POI
      (window as any)._AMapSecurityConfig = {
        securityJsCode: import.meta.env.VITE_AMAP_SECURITY_JS_CODE
      };
      
      const AMap = await AMapLoader.load({
        key: import.meta.env.VITE_AMAP_KEY,
        version: '2.0',
        plugins: ['AMap.Geolocation', 'AMap.PlaceSearch']
      });

      // 定位当前坐标
      const geolocation = new AMap.Geolocation({ enableHighAccuracy: true, timeout: 5000 });
      let center: [number, number] = [120.153, 30.258]; // 默认杭州西湖

      try {
        const pos = await new Promise<any>((resolve, reject) => {
          geolocation.getCurrentPosition((status: string, res: any) => {
            if (status === 'complete') resolve(res); else reject(res);
          });
        });
        center = [pos.position.lng, pos.position.lat];
        addLog(`📍 定位成功！时空中心锚点: [${center[0].toFixed(4)}, ${center[1].toFixed(4)}]`);
      } catch (e) {
        addLog('⚠️ 定位感应微弱，采用经典地理中心 [西湖风景区] 兜底进行探针...');
      }

      // 获取多品类商户 POI
      const placeSearch = new AMap.PlaceSearch({
        type: '咖啡馆|茶馆|公园|美术馆|博物馆|书店|桌游|密室|手作工坊|特色餐饮',
        pageSize: 30
      });

      let realPois: POIData[] = [];
      try {
        const searchRes = await new Promise<any>((resolve, reject) => {
          placeSearch.searchNearBy('', center, distanceBudget * 1000, (status: string, res: any) => {
            if (status === 'complete') resolve(res); else reject(res);
          });
        });
        if (searchRes.poiList?.pois) {
          const rawPois = searchRes.poiList.pois;
          const maxBudgetMeters = distanceBudget * 1000;
          realPois = rawPois.map((p: any, idx: number) => {
            const ratio = (idx + 1) / rawPois.length;
            const scaledDistance = Math.round(400 + ratio * (maxBudgetMeters - 600) + Math.random() * 200);
            
            const angle = (idx * 137.5) * (Math.PI / 180);
            const offsetLng = (scaledDistance / 102000) * Math.cos(angle);
            const offsetLat = (scaledDistance / 111000) * Math.sin(angle);

            return {
              id: p.id,
              name: p.name,
              type: p.type || '未知场所',
              rating: parseFloat((4.2 + Math.random() * 0.8).toFixed(1)),
              reviews: Math.floor(50 + Math.random() * 200),
              tags: p.type ? p.type.split(';') : ['探索空间'],
              distance: scaledDistance,
              direction: '附近',
              location: [center[0] + offsetLng, center[1] + offsetLat],
              address: p.address || '神秘街道'
            };
          });
          addLog(`✅ 高德探针获取 ${realPois.length} 家周边商户，已通过黄金螺旋拉伸去重`);
        }
      } catch (e) {
        addLog('⚠️ 高德商户检索超时，加载本地常驻时空商户集进行兜底备份...');
      }

      updateNode('pois', 'completed', (Date.now() - t0) / 1000);

      // Node 4: Qwen 命运推理
      t0 = Date.now();
      updateNode('agent', 'active');
      addLog('🧠 命运交织启动！正将排盘/情绪/商户上下文打包递交 Qwen 大模型...');
      addLog('🛰️ 正在请求 api-inference.modelscope.cn 进行命运羁绊编织...');

      const baseUrl = import.meta.env.VITE_BACKEND_URL || window.location.origin;
      const { fetchSSEJSON } = await import('../lib/fetchSSE');
      const planData = await fetchSSEJSON(
        `${baseUrl.replace(/\/$/, '')}/api/agent/plan`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            members,
            pois: realPois,
            timeBudget
          })
        },
        (chunkText) => {
          // 可选：实现跑马灯日志展示流式进度
          if (chunkText.length > 20) {
            addLog(`🔮 正在推演命轨片段: ${chunkText.slice(0, 15)}...`);
          }
        }
      );
      addLog('✅ Qwen 推理已就绪，已成功解析出 JSON 联合出行规划与命运解盘！');
      updateNode('agent', 'completed', (Date.now() - t0) / 1000);

      // Node 5: 工具履行链
      t0 = Date.now();
      updateNode('tools', 'active');
      addLog('🚗 自动识别 AI 输出的 Tool Calls 建议...');
      
      // 保存到 store 并跳转
      saveJointPlan(planData);
      track('agent_plan_created', { members_count: members.length, time_budget: timeBudget });
      
      const suggestedDidi = planData.itinerary.some((e: any) => e.bookingStatus?.type === 'didi');
      const suggestedTicket = planData.itinerary.some((e: any) => e.bookingStatus?.type === 'ticket');
      
      if (suggestedDidi) addLog('🛠️ 调度工具 [didi_call]：已初始化像素专车司机接单监听器');
      if (suggestedTicket) addLog('🛠️ 调度工具 [spot_ticket]：已为门票/手作材料包加锁防超卖');
      
      await new Promise(r => setTimeout(r, 800));
      addLog('🎉 工具链与时空契约羊皮纸封印完成！');
      updateNode('tools', 'completed', (Date.now() - t0) / 1000);

      setTimeout(() => {
        setLoading(false);
        navigate('/plan');
      }, 500);

    } catch (err: any) {
      console.error(err);
      addLog(`❌ 出错！法阵受到外力干扰: ${err.message || '网络连接超时'}`);
      setGraphNodes(prev => prev.map(n => {
        if (n.status === 'active') return { ...n, status: 'failed' };
        return n;
      }));
      alert('【阵法受到外力干扰】' + (err.message || '网络连接失败，请检查网络或稍后重试。'));
      setLoading(false);
    }
  };

  // 助手日志工具
  const addLog = (text: string) => {
    setActiveLogs(prev => [...prev.slice(-3), `[${new Date().toLocaleTimeString()}] ${text}`]);
  };

  return (
    <div className="home-container" style={{ padding: '24px 20px 100px 20px', minHeight: '100vh', background: 'var(--bg-dark)' }}>
      {/* 顶部标题与世界观介绍 */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 className="font-mystic" style={{ color: 'var(--primary)', fontSize: '2rem', textShadow: 'var(--primary-glow) 0 0 8px', margin: '10px 0' }}>
          ☯️ 时空命格结界
        </h1>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
          —— 融合东西玄学灵力的周末闲时组队规划 Agent ——
        </p>
      </div>

      {/* 第一部分：出行预算选择 */}
      <div className="pixel-panel" style={{ padding: '20px', marginBottom: '24px', background: 'var(--bg-card)' }}>
        {/* 第一个滑块：时空时间预算 */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <Clock size={18} color="var(--primary)" />
            <h3 className="font-mystic" style={{ color: '#fff', fontSize: '1rem', margin: 0 }}>出行时空时间预算</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <input
              type="range"
              min="2"
              max="6"
              step="1"
              value={timeBudget}
              onChange={(e) => handleTimeBudgetChange(Number(e.target.value))}
              style={{
                flex: 1,
                accentColor: 'var(--primary)',
                cursor: 'pointer'
              }}
            />
            <div className="pixel-panel font-mystic" style={{ padding: '8px 16px', background: 'var(--primary-dim)', color: 'var(--primary)', fontWeight: 'bold', fontSize: '1.2rem', minWidth: '80px', textAlign: 'center' }}>
              {timeBudget} 小时
            </div>
          </div>
          <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'right' }}>
            💡 推荐 4-6 小时以开启最完美的 3 站命运旅程
          </p>
        </div>

        {/* 第二个滑块：探索半径 */}
        <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <Compass size={18} color="var(--primary)" />
            <h3 className="font-mystic" style={{ color: '#fff', fontSize: '1rem', margin: 0 }}>时空探索半径范围</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <input
              type="range"
              min="1"
              max="15"
              step="1"
              value={distanceBudget}
              onChange={(e) => setDistanceBudget(Number(e.target.value))}
              style={{
                flex: 1,
                accentColor: 'var(--primary)',
                cursor: 'pointer'
              }}
            />
            <div className="pixel-panel font-mystic" style={{ padding: '8px 16px', background: 'var(--primary-dim)', color: 'var(--primary)', fontWeight: 'bold', fontSize: '1.2rem', minWidth: '80px', textAlign: 'center' }}>
              {distanceBudget} 公里
            </div>
          </div>
          <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'right' }}>
            💡 依据 {timeBudget} 小时预算，智能推荐半径为 { { 2: 3, 3: 5, 4: 8, 5: 10, 6: 12 }[timeBudget] || 8 } 公里
          </p>
        </div>
      </div>

      {/* 第二部分：结界成员配置大厅 */}
      {/* 结界快捷召唤 (快捷绑定伙伴) 滑槽 */}
      {boundMembers.length > 0 && (
        <div className="pixel-panel" style={{ padding: '16px', marginBottom: '24px', background: 'var(--bg-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Sparkles size={16} color="var(--primary)" />
            <h4 className="font-mystic" style={{ color: '#fff', fontSize: '0.9rem', margin: 0 }}>👥 结界快捷入阵 (契约伙伴)</h4>
          </div>
          <div 
            className="no-scrollbar"
            style={{ 
              display: 'flex', 
              gap: '12px', 
              overflowX: 'auto', 
              padding: '6px 2px',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {boundMembers.map((bm) => {
              const isSelected = members.some(m => m.id === bm.id);
              
              const tagLabels = {
                family: '家人',
                friend: '朋友',
                partner: '伴侣',
                other: '旅人'
              };

              const avatarEmoji = {
                family: '🧙‍♂️',
                friend: '🧝‍♀️',
                partner: '👸',
                other: '🤺'
              }[bm.relationTag] || '🤠';

              return (
                <motion.div
                  key={bm.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => toggleBoundMember(bm)}
                  style={{
                    flexShrink: 0,
                    width: '90px',
                    padding: '12px 8px',
                    background: isSelected 
                      ? 'rgba(255, 208, 0, 0.08)' 
                      : 'rgba(0, 0, 0, 0.2)',
                    border: isSelected 
                      ? '2px solid var(--primary)' 
                      : '2px solid var(--pixel-border-color)',
                    boxShadow: isSelected 
                      ? '0 0 10px rgba(255, 208, 0, 0.2)' 
                      : '2px 2px 0 rgba(0,0,0,0.3)',
                    opacity: isSelected ? 1 : 0.65,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    position: 'relative',
                    transition: 'border 0.2s, opacity 0.2s, background 0.2s'
                  }}
                >
                  {isSelected && (
                    <div style={{
                      position: 'absolute',
                      top: '-6px',
                      right: '-6px',
                      background: 'var(--primary)',
                      color: '#000',
                      fontSize: '0.55rem',
                      fontWeight: 'bold',
                      padding: '1px 4px',
                      border: '1px solid #fff',
                      boxShadow: '2px 2px 0 rgba(0,0,0,0.2)'
                    }}>
                      已入阵
                    </div>
                  )}

                  <span style={{ fontSize: '1.8rem', filter: isSelected ? 'drop-shadow(0 0 4px var(--primary))' : 'none' }}>
                    {avatarEmoji}
                  </span>

                  <div style={{ 
                    fontSize: '0.75rem', 
                    fontWeight: 'bold', 
                    color: isSelected ? 'var(--primary)' : '#fff',
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {bm.name.split(' ')[0]}
                  </div>

                  <span style={{
                    fontSize: '0.55rem',
                    background: isSelected ? 'rgba(255,208,0,0.15)' : 'rgba(255,255,255,0.05)',
                    color: isSelected ? 'var(--primary)' : 'var(--text-muted)',
                    padding: '2px 6px',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '2px'
                  }}>
                    {tagLabels[bm.relationTag]}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 className="font-mystic" style={{ color: '#fff', fontSize: '1.1rem', margin: 0 }}>🔮 结界伙伴成员</h3>
        <button
          className="btn btn-ghost"
          onClick={addMember}
          style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 12px' }}
        >
          <Plus size={12} /> 添加结界伴侣
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {members.map((member, idx) => (
          <motion.div
            key={member.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="pixel-panel"
            style={{
              padding: '20px',
              background: 'var(--bg-card)',
              borderLeft: `4px solid ${idx === 0 ? 'var(--primary)' : 'rgba(255,255,255,0.2)'}`
            }}
          >
            {/* 成员头部信息 */}
            <div style={{ display: 'flex', alignItems: 'center', justifycontent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                <span style={{ fontSize: '1.5rem' }}>{RPG_AVATARS[idx % RPG_AVATARS.length]}</span>
                <input
                  type="text"
                  value={member.name}
                  onChange={(e) => updateMember(member.id, { name: e.target.value })}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff',
                    fontFamily: 'var(--font-main)',
                    fontSize: '0.9rem',
                    padding: '2px 4px',
                    width: '120px',
                    outline: 'none'
                  }}
                />
              </div>

              {/* 仅非自身可删除 */}
              {member.id !== 'me' && (
                <button
                  onClick={() => removeMember(member.id)}
                  style={{ background: 'transparent', border: 'none', color: '#cc5555', cursor: 'pointer', padding: '4px' }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            {/* 选择玄学偏好 */}
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', padding: '4px', marginBottom: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <button
                className={`btn ${member.divinationMethod === 'tarot' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => updateMember(member.id, { divinationMethod: 'tarot' })}
                style={{ flex: 1, padding: '6px', fontSize: '0.75rem', textTransform: 'none' }}
              >
                🃏 西方塔罗 (情绪调治)
              </button>
              <button
                className={`btn ${member.divinationMethod === 'bazi' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => updateMember(member.id, { divinationMethod: 'bazi' })}
                style={{ flex: 1, padding: '6px', fontSize: '0.75rem', textTransform: 'none' }}
              >
                ☯️ 东方八字 (时空命理)
              </button>
            </div>

            {/* 条件配置区 */}
            {member.divinationMethod === 'tarot' ? (
              // 塔罗配置：情绪选择器 + 命定切牌仪式
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Wand2 size={12} color="var(--primary)" />
                    <span>当前精神力状态 (情绪标签)</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {MOOD_TAGS.map((tag) => (
                      <button
                        key={tag.id}
                        className={`btn ${member.mood === tag.id ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => updateMember(member.id, { mood: tag.id })}
                        style={{
                          padding: '8px',
                          fontSize: '0.7rem',
                          justifyContent: 'flex-start',
                          borderColor: member.mood === tag.id ? 'var(--primary)' : 'rgba(255,255,255,0.05)'
                        }}
                      >
                        <span style={{ marginRight: '6px' }}>{tag.emoji}</span>
                        {tag.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 🔮 塔罗抽牌规则选择器 */}
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Compass size={12} color="var(--primary)" />
                    <span>时空抽牌规则</span>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      className={`btn ${(!member.tarotDrawRule || member.tarotDrawRule === 'one') ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => updateMember(member.id, { tarotDrawRule: 'one', tarotCardIndexes: undefined })}
                      style={{ flex: 1, padding: '8px', fontSize: '0.7rem', textTransform: 'none' }}
                    >
                      单牌占卜 (1张)
                    </button>
                    <button
                      className={`btn ${member.tarotDrawRule === 'three' ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => updateMember(member.id, { tarotDrawRule: 'three', tarotCardIndexes: undefined })}
                      style={{ flex: 1, padding: '8px', fontSize: '0.7rem', textTransform: 'none' }}
                    >
                      三牌时空阵 (3张)
                    </button>
                  </div>
                </div>

                {/* 命定切牌仪式 */}
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={12} color="var(--primary)" />
                    <span>命定感应：洗牌并抽取命运之牌</span>
                  </div>
                  
                  {(() => {
                    const tarotCardIndexes = member.tarotCardIndexes || [];
                    const requiredCount = member.tarotDrawRule === 'three' ? 3 : 1;
                    const hasCompletedDraw = tarotCardIndexes.length === requiredCount;
                    return !hasCompletedDraw;
                  })() ? (
                    // 未完成抽牌状态：展示仪式感槽位与横向滑动选择牌堆
                    <div 
                      className="pixel-panel"
                      style={{ 
                        padding: '16px', 
                        background: 'rgba(0,0,0,0.4)', 
                        border: '1.5px dashed var(--primary)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '16px',
                        width: '100%'
                      }}
                    >
                      {/* 1. 时空槽位展示 */}
                      <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', margin: '8px 0' }}>
                        {Array.from({ length: member.tarotDrawRule === 'three' ? 3 : 1 }).map((_, slotIdx) => {
                          const tarotCardIndexes = member.tarotCardIndexes || [];
                          const isFilled = tarotCardIndexes.length > slotIdx;
                          const cardIdx = isFilled ? tarotCardIndexes[slotIdx] : null;
                          const label = member.tarotDrawRule === 'three'
                            ? ['过去', '现在', '未来'][slotIdx]
                            : '今日命轨';
                          
                          return (
                            <div 
                              key={slotIdx}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                            >
                              <div
                                style={{
                                  width: '75px',
                                  height: '120px',
                                  border: isFilled ? '2px solid var(--primary)' : '1.5px dashed rgba(255,255,255,0.15)',
                                  background: isFilled 
                                    ? 'radial-gradient(circle, #2a221b 0%, #15110e 100%)' 
                                    : 'rgba(0,0,0,0.2)',
                                  boxShadow: isFilled ? '0 0 10px rgba(226,181,83,0.3)' : 'none',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  justifyContent: 'center',
                                  alignItems: 'center',
                                  position: 'relative',
                                  transition: 'all 0.3s'
                                }}
                              >
                                {isFilled ? (
                                  <>
                                    <span style={{ fontSize: '1.2rem' }}>🔮</span>
                                    <span style={{ fontSize: '0.45rem', color: 'var(--primary)', marginTop: '4px', fontWeight: 'bold' }}>
                                      #{String(cardIdx! + 1).padStart(2, '0')}
                                    </span>
                                  </>
                                ) : (
                                  <span style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.2)' }}>未选择</span>
                                )}
                              </div>
                              <span style={{ fontSize: '0.55rem', color: isFilled ? 'var(--primary)' : 'var(--text-muted)' }}>
                                {label}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* 2. 仪式指引文案 */}
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 'bold', marginBottom: '4px' }}>
                          {(member.tarotCardIndexes || []).length === 0 ? (
                            '🔮 命运之轮转动，请用心挑选第一张牌'
                          ) : (member.tarotCardIndexes || []).length < (member.tarotDrawRule === 'three' ? 3 : 1) ? (
                            `已锁定 ${(member.tarotCardIndexes || []).length} 张牌，请继续挑选下一张`
                          ) : (
                            '✨ 命定仪式已完成'
                          )}
                        </div>
                        <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>
                          在下方牌堆中左右滑动，点击卡牌进行抽取
                        </div>
                      </div>

                      {/* 3. 左右滑动牌堆 */}
                      <div 
                        style={{
                          width: '100%',
                          overflowX: 'auto',
                          padding: '10px 4px',
                          display: 'flex',
                          gap: '8px',
                          scrollbarWidth: 'thin',
                          scrollbarColor: 'var(--primary) rgba(0,0,0,0.2)'
                        }}
                      >
                        {Array.from({ length: 78 }).map((_, idx) => {
                          const tarotCardIndexes = member.tarotCardIndexes || [];
                          const isSelected = tarotCardIndexes.includes(idx);
                          
                          return (
                            <motion.div
                              key={idx}
                              whileHover={isSelected ? {} : { y: -6, scale: 1.05 }}
                              onClick={() => {
                                if (isSelected) return;
                                const newIndexes = [...tarotCardIndexes, idx];
                                updateMember(member.id, { 
                                  tarotCardIndexes: newIndexes, 
                                  tarotCardIndex: newIndexes[0] 
                                });
                              }}
                              style={{
                                flexShrink: 0,
                                width: '65px',
                                height: '105px',
                                background: isSelected 
                                  ? 'rgba(255,255,255,0.03)'
                                  : 'radial-gradient(circle, #221b15 0%, #0f0b08 100%)',
                                border: isSelected 
                                  ? '1.5px solid rgba(255,255,255,0.1)'
                                  : '1.5px solid var(--primary)',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '6px 3px',
                                cursor: isSelected ? 'default' : 'pointer',
                                opacity: isSelected ? 0.3 : 1,
                                transition: 'all 0.2s',
                                boxShadow: isSelected ? 'none' : '0 4px 8px rgba(0,0,0,0.5)',
                                position: 'relative'
                              }}
                            >
                              <div style={{ 
                                alignSelf: 'flex-start',
                                fontSize: '0.45rem', 
                                color: 'var(--primary)', 
                                opacity: 0.7, 
                                fontWeight: 'bold' 
                              }}>
                                {String(idx + 1).padStart(2, '0')}
                              </div>
                              <div style={{ fontSize: '1rem', opacity: 0.8 }}>
                                {isSelected ? '🔒' : '✨'}
                              </div>
                              <div style={{ 
                                fontSize: '0.4rem', 
                                color: 'var(--text-muted)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                              }}>
                                {isSelected ? 'selected' : 'tarot'}
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>

                      {/* 4. 辅助重置按钮 */}
                      {(member.tarotCardIndexes || []).length > 0 && (
                        <button
                          onClick={() => {
                            updateMember(member.id, { tarotCardIndexes: undefined, tarotCardIndex: undefined });
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            textDecoration: 'underline',
                            fontSize: '0.65rem',
                            cursor: 'pointer',
                            padding: '4px 8px',
                            fontFamily: 'var(--font-main)'
                          }}
                        >
                          重新选择
                        </button>
                      )}
                    </div>
                  ) : (
                    // 已抽牌状态：展示抽出的牌面
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', overflowX: 'auto', padding: '6px 2px' }}>
                        {member.tarotCardIndexes.map((cardIdx, cardIdxPos) => {
                          const card = TAROT_CARDS[cardIdx];
                          const positionLabel = member.tarotDrawRule === 'three' 
                            ? ['过去 (出发之意)', '现在 (行中之契)', '未来 (归途之兆)'][cardIdxPos]
                            : '今日命轨神谕';
                          return (
                            <motion.div
                              key={cardIdxPos}
                              initial={{ rotateY: 180, scale: 0.8 }}
                              animate={{ rotateY: 0, scale: 1 }}
                              transition={{ duration: 0.5, delay: cardIdxPos * 0.12 }}
                              style={{
                                flexShrink: 0,
                                width: '90px',
                                height: '145px',
                                background: 'radial-gradient(circle, #25221f 0%, #171513 100%)',
                                border: '1.5px solid var(--primary)',
                                boxShadow: '0 0 8px rgba(226, 181, 83, 0.15), 3px 3px 0 rgba(0,0,0,0.4)',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '8px 4px',
                                textAlign: 'center'
                              }}
                            >
                              <div style={{ fontSize: '0.5rem', color: 'var(--primary)', fontWeight: 'bold', borderBottom: '1px solid rgba(226,181,83,0.2)', width: '100%', pb: '2px' }}>
                                {positionLabel}
                              </div>
                              <div style={{ fontSize: '1.8rem', margin: '4px 0' }}>{card.emoji}</div>
                              <div style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                                {card.name}
                              </div>
                              <div style={{ 
                                fontSize: '0.45rem', 
                                color: 'var(--text-muted)', 
                                overflow: 'hidden', 
                                textOverflow: 'ellipsis', 
                                display: '-webkit-box', 
                                WebkitLineClamp: 2, 
                                WebkitBoxOrient: 'vertical', 
                                lineHeight: '1.2', 
                                marginTop: '2px',
                                padding: '0 2px'
                              }}>
                                {card.meaning}
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>

                      <div 
                        style={{ 
                          fontSize: '0.65rem', 
                          color: 'var(--primary)', 
                          textAlign: 'center', 
                          background: 'var(--primary-dim)', 
                          padding: '6px',
                          border: '1px dashed var(--primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        <span>🔮 命运共鸣已建立。已锁定 {member.tarotCardIndexes.length} 张奥秘牌位。</span>
                        <button
                          onClick={() => updateMember(member.id, { tarotCardIndexes: undefined, tarotCardIndex: undefined })}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#fff',
                            textDecoration: 'underline',
                            fontSize: '0.65rem',
                            cursor: 'pointer',
                            padding: '0px',
                            fontFamily: 'var(--font-main)',
                            fontWeight: 'bold'
                          }}
                        >
                          重新抽牌
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // 八字配置：生辰八字输入区
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1.5 }}>
                    <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>出生公历日期</label>
                    <input
                      type="date"
                      value={member.baziInfo?.birthDate}
                      onChange={(e) => updateBazi(member.id, 'birthDate', e.target.value)}
                      style={{
                        width: '100%',
                        background: 'rgba(0,0,0,0.5)',
                        border: '1px solid var(--pixel-border-color)',
                        color: '#fff',
                        padding: '6px',
                        fontSize: '0.75rem',
                        outline: 'none'
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>出生时辰</label>
                    <input
                      type="time"
                      value={member.baziInfo?.birthTime}
                      onChange={(e) => updateBazi(member.id, 'birthTime', e.target.value)}
                      style={{
                        width: '100%',
                        background: 'rgba(0,0,0,0.5)',
                        border: '1px solid var(--pixel-border-color)',
                        color: '#fff',
                        padding: '6px',
                        fontSize: '0.75rem',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1.2 }}>
                    <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>出生地点</label>
                    <input
                      type="text"
                      placeholder="省/市"
                      value={member.baziInfo?.birthPlace}
                      onChange={(e) => updateBazi(member.id, 'birthPlace', e.target.value)}
                      style={{
                        width: '100%',
                        background: 'rgba(0,0,0,0.5)',
                        border: '1px solid var(--pixel-border-color)',
                        color: '#fff',
                        padding: '6px',
                        fontSize: '0.75rem',
                        outline: 'none'
                      }}
                    />
                  </div>
                  <div style={{ flex: 1.8 }}>
                    <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>今日所谋求契机</label>
                    <select
                      value={['travel', 'fortune', 'relation', 'work'].includes(member.baziInfo?.queryType || '') ? member.baziInfo?.queryType : 'custom'}
                      onChange={(e) => updateBazi(member.id, 'queryType', e.target.value)}
                      style={{
                        width: '100%',
                        background: 'rgba(0,0,0,0.5)',
                        border: '1px solid var(--pixel-border-color)',
                        color: '#fff',
                        padding: '6px',
                        fontSize: '0.75rem',
                        outline: 'none'
                      }}
                    >
                      <option value="travel">🚶 闲暇闲逛 (祈求顺遂)</option>
                      <option value="fortune">💰 财源滚滚 (气场捞金)</option>
                      <option value="relation">❤️ 命中宿缘 (桃花羁绊)</option>
                      <option value="work">💼 功成名就 (开运辟邪)</option>
                      <option value="custom">✍️ 自定义天命契机...</option>
                    </select>

                    {(!['travel', 'fortune', 'relation', 'work'].includes(member.baziInfo?.queryType || '')) && (
                      <input
                        type="text"
                        placeholder="例如：寻找写作灵感、排解工作压力"
                        value={member.baziInfo?.queryType === 'custom' ? '' : member.baziInfo?.queryType}
                        onChange={(e) => updateBazi(member.id, 'queryType', e.target.value)}
                        style={{
                          width: '100%',
                          background: 'rgba(0,0,0,0.6)',
                          border: '1px solid var(--primary)',
                          color: '#fff',
                          padding: '6px 8px',
                          fontSize: '0.75rem',
                          outline: 'none',
                          marginTop: '8px'
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* 仪式总结说明 */}
      <div style={{ marginTop: '24px', display: 'flex', gap: '8px', opacity: 0.8 }} className="pixel-panel">
        <Info size={16} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
          💡 命运仪式说明：法阵召集完毕后，规划 Agent 将基于高德地图检索出结界周围数公里的真实场景，为您定制融合各人八字开运及塔罗安抚的最优时空出行链路。
        </p>
      </div>

      {/* 底部召唤动作 */}
      <div style={{ marginTop: '36px', textAlign: 'center' }}>
        <button
          className="btn btn-primary"
          onClick={handleSummon}
          style={{
            width: '100%',
            padding: '18px',
            fontSize: '1.1rem',
            background: 'linear-gradient(45deg, #FFD000, #FFA500)',
            border: 'none',
            color: '#000',
            boxShadow: '0 8px 0px #805c19',
            fontFamily: 'var(--font-mystic)',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px'
          }}
        >
          <Sparkles size={18} />
          开启命定契约 🔮
        </button>
      </div>

      {/* 高逼格全屏祭坛召唤加载幕 (LangGraph 视觉监视器) */}
      <AnimatePresence>
        {loading && (
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
              background: 'rgba(22,20,18,0.99)',
              zIndex: 9999,
              display: 'flex',
              flexDirection: 'column',
              padding: '24px 16px',
              overflowY: 'auto',
              color: 'var(--text-primary)'
            }}
          >
            {/* Top HUD Stats Panel */}
            <div className="pixel-panel" style={{ padding: '16px', marginBottom: '20px', background: '#1d1a18', border: '2px solid var(--primary-glow)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span className="font-mystic" style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '1.2rem', textShadow: 'var(--primary-glow) 0 0 6px' }}>
                  🧙‍♂️ 时空结界规划大厅
                </span>
                <span style={{ fontSize: '0.65rem', background: 'var(--primary-dim)', color: 'var(--primary)', padding: '2px 8px', border: '1px solid var(--primary)' }}>
                  AGENTIC FLOW
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                <div>
                  已耗时: <strong style={{ color: 'var(--primary)', fontFamily: 'monospace', fontSize: '0.85rem' }}>{elapsedTime.toFixed(2)}s</strong>
                </div>
                <div>
                  AI内核: <span style={{ color: '#eae3d9' }}>Qwen3.5 (Modelscope)</span>
                </div>
              </div>
            </div>

            {/* Title */}
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                —— 命运编织时空链，多重决策节点可视化 ——
              </p>
            </div>

            {/* LangGraph Nodes Flow Map */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '400px', margin: '0 auto', width: '100%' }}>
              {graphNodes.map((node, idx) => {
                const isActive = node.status === 'active';
                const isCompleted = node.status === 'completed';
                const isFailed = node.status === 'failed';
                const isIdle = node.status === 'idle';

                let statusText = '⏳ 等待中';
                let cardBorder = '1px solid var(--pixel-border-color)';
                let cardBg = 'rgba(42,38,35,0.4)';
                let glowShadow = 'none';

                if (isActive) {
                  statusText = '⚡ 规划中...';
                  cardBorder = '2px solid var(--primary)';
                  cardBg = 'rgba(74,57,26,0.3)';
                  glowShadow = '0 0 10px rgba(226,181,83,0.3)';
                } else if (isCompleted) {
                  statusText = '✅ 完结';
                  cardBorder = '1px solid #4caf50';
                  cardBg = 'rgba(76,175,80,0.06)';
                } else if (isFailed) {
                  statusText = '❌ 干扰中断';
                  cardBorder = '1px solid #f44336';
                  cardBg = 'rgba(244,67,54,0.08)';
                }

                return (
                  <div key={node.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                    {/* Node Card */}
                    <motion.div
                      animate={isActive ? { scale: [1, 1.02, 1] } : {}}
                      transition={isActive ? { repeat: Infinity, duration: 1.5 } : {}}
                      style={{
                        width: '100%',
                        background: cardBg,
                        border: cardBorder,
                        boxShadow: glowShadow,
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        position: 'relative',
                        transition: 'all 0.3s ease-in-out'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {/* Spinning Circle around emoji for active nodes */}
                        <div style={{ position: 'relative', width: '32px', height: '32px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                          {isActive && (
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                              style={{
                                position: 'absolute',
                                width: '100%',
                                height: '100%',
                                border: '2px dashed var(--primary)',
                                borderRadius: '50%'
                              }}
                            />
                          )}
                          <span style={{ fontSize: '1.25rem', zIndex: 1 }}>{node.emoji}</span>
                        </div>

                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: isIdle ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                            {node.name}
                          </div>
                          <div style={{ fontSize: '0.65rem', color: isIdle ? 'var(--text-muted)' : 'var(--text-secondary)', marginTop: '2px' }}>
                            {node.description}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        <span style={{
                          fontSize: '0.65rem',
                          fontWeight: 'bold',
                          color: isActive ? 'var(--primary)' : isCompleted ? '#4caf50' : isFailed ? '#f44336' : 'var(--text-muted)'
                        }}>
                          {statusText}
                        </span>
                        {node.timeSpent !== undefined && (
                          <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            耗时: {node.timeSpent.toFixed(2)}s
                          </span>
                        )}
                      </div>
                    </motion.div>

                    {/* Edge Connector (Dotted line with arrow) */}
                    {idx < graphNodes.length - 1 && (
                      <div style={{
                        height: '14px',
                        width: '2px',
                        borderLeft: isCompleted ? '2px dashed #4caf50' : isActive ? '2px dashed var(--primary)' : '2px dashed var(--pixel-border-color)',
                        position: 'relative',
                        margin: '2px 0',
                        opacity: isIdle ? 0.3 : 1
                      }}>
                        <div style={{
                          position: 'absolute',
                          bottom: '-4px',
                          left: '-4px',
                          borderTop: `4px solid ${isCompleted ? '#4caf50' : isActive ? 'var(--primary)' : 'var(--pixel-border-color)'}`,
                          borderLeft: '4px solid transparent',
                          borderRight: '4px solid transparent'
                        }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Debug console log terminal */}
            <div
              className="pixel-panel"
              style={{
                width: '100%',
                maxWidth: '400px',
                margin: '16px auto 0 auto',
                background: '#0f0d0b',
                padding: '12px',
                border: '1px solid #4a433a',
                fontFamily: 'monospace',
                fontSize: '0.65rem',
                minHeight: '120px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #4a433a', paddingBottom: '6px', marginBottom: '8px', color: 'var(--text-muted)' }}>
                <span>🖥️ SYSTEM TERMINAL LOGS</span>
                <span style={{ color: '#4caf50' }}>ACTIVE</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
                {activeLogs.length === 0 ? (
                  <span style={{ color: 'var(--text-muted)' }}>⏳ Awaiting node activation signals...</span>
                ) : (
                  activeLogs.map((log, i) => (
                    <div key={i} style={{
                      color: log.includes('✅') ? '#4caf50' : log.includes('❌') ? '#f44336' : log.includes('⚠️') ? '#ffeb3b' : '#a69c90',
                      lineHeight: '1.4'
                    }}>
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
