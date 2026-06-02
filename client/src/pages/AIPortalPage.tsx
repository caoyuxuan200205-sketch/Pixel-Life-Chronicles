import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Compass, Sparkles, Wand2, Clock, MapPin, CheckCircle, Navigation, Info, ChevronRight, User, Send, RefreshCw, Trash2, Download, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import { getCurrentUser, getBoundMembers, type BoundMember } from '../store';

// ==========================================
// 轻量级客户端算命排盘计算器 (保证与服务端完全一致)
// ==========================================
const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const ELEMENT_MAP: Record<string, string> = {
  '甲': '木', '乙': '木', '丙': '火', '丁': '火', '戊': '土', '己': '土', '庚': '金', '辛': '金', '壬': '水', '癸': '水',
  '寅': '木', '卯': '木', '巳': '火', '午': '火', '辰': '土', '戌': '土', '丑': '土', '未': '土', '申': '金', '酉': '金',
  '子': '水', '亥': '水'
};

function calculateFrontBazi(birthDateStr: string, birthTimeStr: string) {
  const [year, month, day] = birthDateStr.split('-').map(Number);
  const [hour] = birthTimeStr.split(':').map(Number);
  
  // 年柱
  let yearOffset = year - 4;
  if (month === 1 || (month === 2 && day < 4)) {
    yearOffset -= 1;
  }
  const yearStem = STEMS[(yearOffset % 10 + 10) % 10];
  const yearBranch = BRANCHES[(yearOffset % 12 + 12) % 12];

  // 月柱
  const monthBranchIndex = (month % 12 + 10) % 12;
  const monthBranch = BRANCHES[monthBranchIndex];
  const yearStemIndex = (yearOffset % 10 + 10) % 10;
  let firstMonthStemIndex = 0;
  if (yearStemIndex === 0 || yearStemIndex === 5) firstMonthStemIndex = 2; // 丙
  else if (yearStemIndex === 1 || yearStemIndex === 6) firstMonthStemIndex = 4; // 戊
  else if (yearStemIndex === 2 || yearStemIndex === 7) firstMonthStemIndex = 6; // 庚
  else if (yearStemIndex === 3 || yearStemIndex === 8) firstMonthStemIndex = 8; // 壬
  else if (yearStemIndex === 4 || yearStemIndex === 9) firstMonthStemIndex = 0; // 甲

  const monthOffsetFromJan = (month - 2 + 12) % 12;
  const monthStem = STEMS[(firstMonthStemIndex + monthOffsetFromJan) % 10];

  // 日柱
  const baseDate = new Date(2000, 0, 1);
  const targetDate = new Date(year, month - 1, day, hour, 0);
  const diffDays = Math.floor((Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()) - Date.UTC(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate())) / (1000 * 60 * 60 * 24));
  
  const dayStemIndex = ((4 + diffDays) % 10 + 10) % 10;
  const dayStem = STEMS[dayStemIndex];

  // 幸运五行 (最稀缺五行)
  const eightChars = [yearStem, yearBranch, monthStem, monthBranch, dayStem];
  const elementCounts: Record<string, number> = { '金': 0, '木': 0, '水': 0, '火': 0, '土': 0 };
  eightChars.forEach(char => {
    const el = ELEMENT_MAP[char];
    if (el) elementCounts[el]++;
  });

  const mainElement = ELEMENT_MAP[dayStem] || '土';
  let luckyElement = '金';
  let minCount = 99;
  Object.keys(elementCounts).forEach(el => {
    if (el !== mainElement && elementCounts[el] < minCount) {
      minCount = elementCounts[el];
      luckyElement = el;
    }
  });

  return { mainElement, luckyElement };
}

// ==========================================
// 模拟美团周边游酒旅常驻数据集 (兜底用)
// ==========================================
const MEITUAN_MOCK_DATA: Record<string, { hotel: any; scenic: any }> = {
  '金': {
    hotel: {
      name: '🏨 莫干山白金私汤庄园',
      rating: '4.9分 (美团金牌推荐)',
      tag: '五行金火开运 | 私山汤池',
      price: '￥580/晚',
      room: '翠竹独栋私汤大床房 (今日特惠8.8折)',
      desc: '依傍西方白虎余脉，庄园以纯白金石质感结合恒温竹林汤泉设计，完美契合您的补金开运属性。'
    },
    scenic: {
      name: '🏕️ 白虎岩野奢矿坑探险景区',
      rating: '4.8分 (本周自驾热度No.1)',
      tag: '五行金木互补 | 矿脉越野',
      price: '￥98 (门票+玻璃桥套票)',
      desc: '位于您西偏北方位，独特的白垩纪金石矿脉奇观，内设高空玻璃天桥与越野车，吸纳金刚生威之气。'
    }
  },
  '水': {
    hotel: {
      name: '🏨 千岛湖玄武临水木屋度假村',
      rating: '4.9分 (避世临水榜No.1)',
      tag: '五行水木相生 | 临湖星空',
      price: '￥620/晚',
      room: '玄武临湖星空软顶大床房',
      desc: '北临玄武湖湾，全屋木质榫卯浮于清波之上，清晨薄雾弥漫，对于缺水命格具有极佳的水系元气疗愈效果。'
    },
    scenic: {
      name: '🏕️ 玄河大峡谷瀑布湿地公园',
      rating: '4.7分 (亲水徒步圣地)',
      tag: '五行坎水共鸣 | 瀑布徒步',
      price: '￥75 (湿地游船联票)',
      desc: '正北坎水位，拥有三级悬空飞瀑与万亩原始湿地，水汽充沛。游船于碧波中，洗涤心流杂质。'
    }
  },
  '木': {
    hotel: {
      name: '🏨 安吉青龙翠竹隐奢山庄',
      rating: '4.9分 (美团必住榜)',
      tag: '五行木土稳固 | 万亩竹海',
      price: '￥699/晚',
      room: '青龙观竹露台豪华大床房',
      desc: '向东行进，山庄隐匿于安吉万亩毛竹林深处，富氧离子爆棚，是舒缓肝木之气的绝对开运避世所。'
    },
    scenic: {
      name: '🏕️ 青龙山国家森林古道景区',
      rating: '4.8分 (避暑康养名胜)',
      tag: '五行木水互补 | 森林徒步',
      price: '￥45 (古道漫步门票)',
      desc: '正东青龙方位，千年青石古道蜿蜒于高大参天古树之下。林下有溪，行进其中可调和经脉，吸纳木气灵性。'
    }
  },
  '火': {
    hotel: {
      name: '🏨 临安朱雀地热温泉古镇民宿',
      rating: '4.8分 (温泉必去榜)',
      tag: '五行火土双耀 | 碳酸硫磺泉',
      price: '￥480/晚',
      room: '朱雀暖玉私汤榻榻米房 (赠送欢迎水果)',
      desc: '正南方朱雀大吉位，直引地下 1500 米碳酸热泉。红枫古木环绕，温泉暖流汇聚，最能温养火红本元。'
    },
    scenic: {
      name: '🏕️ 红叶谷地火山地热大峡谷',
      rating: '4.7分 (特色峡谷风情)',
      tag: '五行火木双生 | 熔岩温泉',
      price: '￥80 (大门票+地热体验)',
      desc: '向南行进，拥有远古火山地壳断层遗迹，山崖常年赤红，内设熔岩观赏台与温暖峡谷攀爬步道。'
    }
  },
  '土': {
    hotel: {
      name: '🏨 中原古城勾陈厚土庭院客栈',
      rating: '4.9分 (历史印记金牌店)',
      tag: '五行土金生财 | 砖雕古宅',
      price: '￥399/晚',
      room: '勾陈厚土雕花大床房',
      desc: '客栈居于古城中轴核心，采用非遗青砖灰瓦结构，厚德载物。稳重的中土气场能牢固财运本根。'
    },
    scenic: {
      name: '🏕️ 勾陈大峡谷手作陶瓷艺术景区',
      rating: '4.6分 (人文非遗景区)',
      tag: '五行土木同源 | 柴窑拉胚',
      price: '￥60 (包含非遗拉胚泥塑体验)',
      desc: '中西部地段，集黄土断崖、古法柴窑、拉胚泥塑手作为一体。亲手抚摸厚土，接引地心最稳健能量。'
    }
  }
};

// 五行动态主题包 (提供极奢像素玄学质感)
const ELEMENT_THEME_MAP: Record<string, {
  color: string;
  glow: string;
  gradient: string;
  cardBg: string;
  accent: string;
  badgeBg: string;
}> = {
  '木': {
    color: '#3CD070',
    glow: 'rgba(60, 208, 112, 0.4)',
    gradient: 'linear-gradient(135deg, #12291a 0%, #08140d 100%)',
    cardBg: 'rgba(60, 208, 112, 0.08)',
    accent: '#4ef289',
    badgeBg: 'rgba(60, 208, 112, 0.15)'
  },
  '火': {
    color: '#FF5E5E',
    glow: 'rgba(255, 94, 94, 0.4)',
    gradient: 'linear-gradient(135deg, #2b1313 0%, #140808 100%)',
    cardBg: 'rgba(255, 94, 94, 0.08)',
    accent: '#ff8585',
    badgeBg: 'rgba(255, 94, 94, 0.15)'
  },
  '金': {
    color: '#E2B553',
    glow: 'rgba(226, 181, 83, 0.4)',
    gradient: 'linear-gradient(135deg, #292113 0%, #140f08 100%)',
    cardBg: 'rgba(226, 181, 83, 0.08)',
    accent: '#ffd369',
    badgeBg: 'rgba(226, 181, 83, 0.15)'
  },
  '水': {
    color: '#4CA3F5',
    glow: 'rgba(76, 163, 245, 0.4)',
    gradient: 'linear-gradient(135deg, #13212e 0%, #081017 100%)',
    cardBg: 'rgba(76, 163, 245, 0.08)',
    accent: '#75beff',
    badgeBg: 'rgba(76, 163, 245, 0.15)'
  },
  '土': {
    color: '#A87A54',
    glow: 'rgba(168, 122, 84, 0.4)',
    gradient: 'linear-gradient(135deg, #241a12 0%, #100b07 100%)',
    cardBg: 'rgba(168, 122, 84, 0.08)',
    accent: '#cfa27c',
    badgeBg: 'rgba(168, 122, 84, 0.15)'
  }
};

const DIRECTIONS_MAP: Record<string, { dir: string; angle: number; color: string; desc: string }> = {
  '木': { dir: '正东 (青龙方位)', angle: 90, color: '#3CD070', desc: '宜往东方茂密林木、高山深林行进，调和肝木，吐纳生机。' },
  '火': { dir: '正南 (朱雀方位)', angle: 180, color: '#FF5E5E', desc: '宜往南方地热温泉、夜市古镇行进，温养阳和之气。' },
  '金': { dir: '正西 (白虎方位)', angle: 270, color: '#E2B553', desc: '宜往西方历史古刹、怪石奇峰行进，聚敛白金制造之气。' },
  '水': { dir: '正北 (玄武方位)', angle: 0, color: '#4CA3F5', desc: '宜往北方临水民宿、湿地湖泊行进，洗涤坎水灵性。' },
  '土': { dir: '中部/西南 (勾陈方位)', angle: 225, color: '#A87A54', desc: '宜往中西部平原阔野、手作陶艺工坊行进，稳固中土元气。' }
};

export const AIPortalPage = () => {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();

  // 补全真实美团 App 唤醒跳转链接生成器
  const getMeituanSearchUrl = (keyword: string) => {
    // 过滤掉 emoji 字符，如 🏨 或 🏕️
    const cleanKeyword = keyword.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDC00-\uDFFF]/g, '').trim();
    return `https://i.meituan.com/s/${encodeURIComponent(cleanKeyword)}`;
  };

  // 1. 判断玄学大结界基础参数
  const [luckyElement, setLuckyElement] = useState('金');
  const [mainElement, setMainElement] = useState('水');
  
  // 罗盘动画控制与交互
  const [spinSpeed, setSpinSpeed] = useState(20); // 慢速自动转
  const [isCompassHovered, setIsCompassHovered] = useState(false);

  // 2. AI 对话聊天历史与输入管理
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant', content: string }>>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // 记录每个消息卡片的多路 Booking 预订状态和截屏状态
  const [bookingSuccessMap, setBookingSuccessMap] = useState<Record<number, boolean>>({});
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureProgress, setCaptureProgress] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 获取当前幸运五行动态主题
  const theme = ELEMENT_THEME_MAP[luckyElement] || ELEMENT_THEME_MAP['土'];
  const currentDir = DIRECTIONS_MAP[luckyElement] || DIRECTIONS_MAP['土'];

  // 初始化提取八字方位
  useEffect(() => {
    if (!currentUser) {
      navigate('/auth', { replace: true });
      return;
    }
    
    // 如果设置了个人八字，解析得出幸运五行
    if (currentUser.baziInfo) {
      const { mainElement: me, luckyElement: le } = calculateFrontBazi(
        currentUser.baziInfo.birthDate,
        currentUser.baziInfo.birthTime
      );
      setMainElement(me);
      setLuckyElement(le);
    }
  }, [currentUser?.id, currentUser?.baziInfo?.birthDate, currentUser?.baziInfo?.birthTime, navigate]);

  // 天命迎新欢迎语
  const welcomeSpeech = `🔮 探险者 **${currentUser?.username || '探索者'}**，欢迎入阵星耀命盘。我是您的“时空探路祭司”。

感应到您的幸运五行属【**${luckyElement}**】，今日地利开运方位：【**${currentDir.dir}**】。

您可以直接向我倾诉心底最渴望的那趟“天命出游心里话”（例如：*我想去个清静的地方泡温泉、吃土鸡*），或者任何出行的诉求。我会即刻为您编织出吉时与美团酒旅开运契约！`;

  // 4. 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // 判断是否已经开启过真实用户对话
  const hasUserMessages = messages.some(m => m.role === 'user');

  // 发送消息核心逻辑
  const handleSendMessage = async (customQuery?: string) => {
    const textToSend = customQuery !== undefined ? customQuery : inputValue;
    if (!textToSend.trim() || isLoading) return;

    // 清空输入框
    setInputValue('');

    let updatedHistory = [...messages];
    
    // 首次开始聊天时，在聊天历史中预埋 Priest 的欢迎词，构建自然连贯的对话流程
    if (!hasUserMessages) {
      updatedHistory = [
        { role: 'assistant', content: welcomeSpeech },
        { role: 'user', content: textToSend.trim() }
      ];
    } else {
      updatedHistory.push({ role: 'user', content: textToSend.trim() });
    }

    setMessages(updatedHistory);
    setIsLoading(true);

    try {
      const baseUrl = import.meta.env.VITE_BACKEND_URL || window.location.origin;
      // 过滤系统欢迎词，打包真实上下文
      const chatHistory = updatedHistory.map(m => ({ role: m.role, content: m.content }));
      
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: chatHistory,
          luckyElement,
          city: currentUser?.baziInfo?.birthPlace || '杭州',
          username: currentUser?.username || '探索者'
        })
      });

      if (!response.ok) {
        let errorMsg = '对话召集令未获响应';
        try {
          const errJSON = await response.json();
          if (errJSON && errJSON.error) {
            errorMsg = errJSON.error;
          }
        } catch (_) {}
        throw new Error(errorMsg);
      }

      const resData = await response.json();
      if (resData.success && resData.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: resData.reply }]);
      } else {
        throw new Error(resData.error || '解析出游契约答复失败');
      }
    } catch (err: any) {
      console.error('Chat AI query error:', err);
      
      // 真实反馈错误，完全禁用降级兜底方案
      await new Promise(r => setTimeout(r, 800));
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ 时空天命法则编织失败！\n\n【时空断裂报错】：${err.message || err || '未知时空扰动'}\n\n这表明当前 AI 调用未成功跑通。请检查后端环境配置中的 \`QWEN_API_KEY\` 是否正确设置、服务是否在线，或重试提问。`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // 重置对话线程，清除所有状态并返回 Splash
  const handleRestartChat = () => {
    if (window.confirm('您确定要清空当前的对话，重新向探路祭司卜算提问吗？')) {
      setMessages([]);
      setBookingSuccessMap({});
      setInputValue('');
    }
  };

  // 辅助 JSON 解析器 (扫描 XML 标签)
  const parseMessageContent = (text: string) => {
    const dealRegex = /<travel_deal>([\s\S]*?)<\/travel_deal>/;
    const match = text.match(dealRegex);
    if (match) {
      const rawJson = match[1].trim();
      const textWithoutDeal = text.replace(dealRegex, '').trim();
      try {
        const dealData = JSON.parse(rawJson);
        return { text: textWithoutDeal, deal: dealData };
      } catch (e) {
        console.error('Failed to parse deal JSON:', e);
        return { text, deal: null };
      }
    }
    return { text, deal: null };
  };

  // 预订成功触发
  const handleConfirmBooking = (index: number) => {
    setBookingSuccessMap(prev => ({
      ...prev,
      [index]: true
    }));
  };

  // 截图并导出避世契约
  const handleCaptureTicket = async (index: number) => {
    setIsCapturing(true);
    setCaptureProgress('🔮 正在凝聚契约法阵长卷...');
    
    // 稍作等待以确保渲染稳定
    setTimeout(async () => {
      try {
        const cardElement = document.getElementById(`ticket-card-${index}`);
        if (!cardElement) {
          throw new Error('未找到契约卡片节点');
        }

        const canvas = await html2canvas(cardElement, {
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#120d1c', // 契约暗色调
          scale: 2,
          scrollX: 0,
          scrollY: 0,
          windowWidth: cardElement.scrollWidth,
          windowHeight: cardElement.scrollHeight
        });

        const imgUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `星耀AI_天命出行契约_No${index}.png`;
        link.href = imgUrl;
        link.click();
      } catch (err) {
        console.error('Capture ticket image error:', err);
        alert('编织契约卷轴图失败，请尝试直接手机截图。');
      } finally {
        setIsCapturing(false);
        setCaptureProgress('');
      }
    }, 400);
  };

  // 根据当前时间计算问候语 (仿漫旅风格)
  const getTimeGreeting = (username: string) => {
    const hr = new Date().getHours();
    let timeStr = '午安';
    if (hr < 5) timeStr = '夜深了';
    else if (hr < 11) timeStr = '早安';
    else if (hr < 14) timeStr = '午安';
    else if (hr < 18) timeStr = '下午好';
    else timeStr = '晚安';
    return `${timeStr}，${username}`;
  };

  // 渲染单条对话气泡组件 (包含 inline 卡片展示)
  const renderMessage = (msg: typeof messages[0], index: number) => {
    const isUser = msg.role === 'user';
    const { text, deal } = parseMessageContent(msg.content);
    const isBooked = bookingSuccessMap[index];

    return (
      <div 
        key={index} 
        style={{ 
          display: 'flex', 
          justifyContent: isUser ? 'flex-end' : 'flex-start',
          alignItems: 'flex-start',
          gap: '10px',
          width: '100%',
          marginBottom: '20px',
          padding: '0 4px'
        }}
      >
        {/* 探路祭司头像 */}
        {!isUser && (
          <div style={{
            flexShrink: 0,
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'var(--primary-dim)',
            border: `2px solid ${theme.color}`,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            fontSize: '1.25rem',
            boxShadow: `0 0 8px ${theme.glow}`
          }}>
            🧙‍♂️
          </div>
        )}

        {/* 气泡及契约 */}
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '80%', gap: '10px' }}>
          
          {/* 文字内容 */}
          <div 
            className="pixel-panel"
            style={{ 
              padding: '12px 14px', 
              background: isUser ? 'rgba(226, 181, 83, 0.12)' : 'var(--bg-card)', 
              border: isUser ? '1px solid var(--primary)' : `1px solid var(--pixel-border-color)`,
              color: '#fff',
              fontSize: '0.8rem',
              lineHeight: '1.6',
              textAlign: 'left',
              borderRadius: '4px',
              whiteSpace: 'pre-wrap',
              boxShadow: isUser ? '0 0 10px rgba(226, 181, 83, 0.05)' : 'none'
            }}
          >
            {/* 顶栏昵称 */}
            <div style={{ fontSize: '0.65rem', color: isUser ? '#FFE169' : theme.color, fontWeight: 'bold', marginBottom: '4px' }}>
              {isUser ? `${currentUser?.username || '探索者'}` : '时空探路祭司'}
            </div>
            
            {text}
          </div>

          {/* 美团代订开运契约 Ticket 卡片 */}
          {deal && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              id={`ticket-card-${index}`}
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '0px', 
                width: '100%', 
                maxWidth: '320px', 
                marginTop: '4px',
                border: `2px solid ${theme.color}`,
                boxShadow: `0 0 15px ${theme.glow}, 4px 4px 0 rgba(0,0,0,0.5)`,
                borderRadius: '0px',
                background: 'linear-gradient(135deg, #1b1624 0%, #0d0a12 100%)',
                overflow: 'hidden',
                position: 'relative'
              }}
            >
              {/* 卡片顶头饰条 */}
              <div style={{ 
                height: '8px', 
                background: `linear-gradient(90deg, ${theme.color} 0%, rgba(255,255,255,0.2) 50%, ${theme.color} 100%)` 
              }} />

              {/* 契约头部 */}
              <div style={{ padding: '12px 14px 8px 14px', borderBottom: '1px dashed rgba(255,255,255,0.1)', position: 'relative' }}>
                <span className="font-mystic" style={{ fontSize: '0.95rem', fontWeight: 'bold', color: theme.color, textShadow: `0 0 8px ${theme.glow}`, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  📜 时空避世出游契约
                </span>
                <span style={{ fontSize: '0.55rem', position: 'absolute', top: '15px', right: '14px', color: '#ffb300', border: '1px solid #ffb300', padding: '1px 3px' }}>
                  {luckyElement}命特惠
                </span>
              </div>

              {/* 卡片核心：民宿/酒店 */}
              <div style={{ padding: '14px 14px 8px 14px', borderBottom: '1px dashed rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', gap: '6px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#fff', textAlign: 'left' }}>{deal.hotel.name}</span>
                  <span style={{ fontSize: '0.5rem', color: theme.color, background: theme.badgeBg, border: `1px solid ${theme.color}`, padding: '1px 4px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {deal.hotel.tag}
                  </span>
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '4px', textAlign: 'left' }}>
                  评分: <strong style={{ color: '#E2B553' }}>{deal.hotel.rating}</strong> | 房型: <span style={{ color: '#fff' }}>{deal.hotel.room}</span>
                </div>
                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: '1.4', margin: '0 0 6px 0', textAlign: 'left', fontStyle: 'italic' }}>
                  {deal.hotel.desc}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: theme.color }}>{deal.hotel.price}</span>
                  <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>美团房源已锁定 1 间</span>
                </div>
              </div>

              {/* 电影票撕碎半圆缺口 & 虚线分界 */}
              <div style={{ display: 'flex', alignItems: 'center', width: '100%', height: '14px', overflow: 'hidden', position: 'relative' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#0d0b0a', borderRight: `2px solid ${theme.color}`, marginLeft: '-6px', zIndex: 10 }} />
                <div style={{ flex: 1, borderTop: '2px dashed rgba(255,255,255,0.15)', margin: '0 4px' }} />
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#0d0b0a', borderLeft: `2px solid ${theme.color}`, marginRight: '-6px', zIndex: 10 }} />
              </div>

              {/* 卡片核心：景区 */}
              <div style={{ padding: '8px 14px 14px 14px', borderBottom: '1px dashed rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', gap: '6px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#fff', textAlign: 'left' }}>{deal.scenic.name}</span>
                  <span style={{ fontSize: '0.5rem', color: '#3CD070', background: 'rgba(60, 208, 112, 0.1)', border: '1px solid #3CD070', padding: '1px 4px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {deal.scenic.tag}
                  </span>
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '4px', textAlign: 'left' }}>
                  推荐: <strong style={{ color: '#3CD070' }}>{deal.scenic.rating}</strong> | 预订: <span style={{ color: '#fff' }}>即开极速预约</span>
                </div>
                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: '1.4', margin: '0 0 6px 0', textAlign: 'left', fontStyle: 'italic' }}>
                  {deal.scenic.desc}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#3CD070' }}>{deal.scenic.price}</span>
                  <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>包含周边游门票套餐</span>
                </div>
              </div>

              {/* 出行吉时条 */}
              <div style={{ 
                display: 'flex', 
                gap: '6px', 
                padding: '10px 14px', 
                background: 'rgba(226,181,83,0.04)', 
                borderBottom: '1px dashed rgba(255,255,255,0.08)',
                fontSize: '0.65rem', 
                color: '#fff', 
                textAlign: 'left'
              }}>
                <Clock size={13} style={{ color: theme.color, flexShrink: 0, marginTop: '1px' }} />
                <div>
                  🚙 <b style={{ color: theme.color }}>自驾出征吉时</b>：
                  <span style={{ color: '#fff', fontWeight: 'bold' }}> {deal.auspiciousHour.time}</span> | 【{deal.auspiciousHour.label}】 {deal.auspiciousHour.desc}
                </div>
              </div>

              {/* 预订操作区域 */}
              <div style={{ padding: '12px 14px' }}>
                {!isBooked ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => handleConfirmBooking(index)}
                      style={{
                        width: '100%',
                        padding: '12px 10px',
                        background: `linear-gradient(45deg, ${theme.color}, ${theme.accent})`,
                        border: 'none',
                        color: '#000',
                        fontWeight: 'bold',
                        boxShadow: `0 4px 0px rgba(0,0,0,0.4)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        fontSize: '0.75rem',
                        fontFamily: 'var(--font-mystic)',
                        cursor: 'pointer',
                        transition: 'all 0.1s'
                      }}
                      onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(2px)'; e.currentTarget.style.boxShadow = '0 2px 0px rgba(0,0,0,0.4)'; }}
                      onMouseUp={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 0px rgba(0,0,0,0.4)'; }}
                    >
                      <span>🤝 一键锁定天命契约并付款 (美团代订)</span>
                    </button>
                    
                    {/* 去真实美团对比/查看 */}
                    <a
                      href={getMeituanSearchUrl(deal.hotel.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1.5px solid rgba(255, 255, 255, 0.12)',
                        color: '#eae3d9',
                        fontSize: '0.62rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px',
                        textDecoration: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        borderRadius: '0px'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = theme.color; e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                    >
                      <span>🌐 唤醒美团 App 对比真实房源</span>
                    </a>
                  </div>
                ) : (
                  <div
                    className="pixel-panel"
                    style={{
                      padding: '16px 12px',
                      background: 'rgba(21, 36, 21, 0.75)',
                      border: '2px solid #4caf50',
                      color: '#4caf50',
                      textAlign: 'center',
                      fontFamily: 'var(--font-mystic)',
                      borderRadius: '0px'
                    }}
                  >
                    {/* CSS bar code 创意条码 */}
                    <div style={{ 
                      display: 'flex', 
                      gap: '2px', 
                      height: '24px', 
                      justifyContent: 'center', 
                      margin: '2px 0 8px 0', 
                      opacity: 0.6,
                      background: 'rgba(255,255,255,0.05)',
                      padding: '4px'
                    }}>
                      {[1, 3, 1, 2, 4, 1, 2, 3, 1, 4, 2, 1, 3, 1, 2, 1, 3, 2, 1, 4].map((w, idx) => (
                        <div key={idx} style={{ width: `${w}px`, background: '#4caf50', height: '100%' }} />
                      ))}
                    </div>

                    <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>🎟️</div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: '#81c784' }}>天命出行契约缔结！</h4>
                    <p style={{ fontSize: '0.6rem', color: '#a5d6a7', lineHeight: '1.4', margin: '0 0 10px 0' }}>
                      已成功使用您的绑定账户完成一键代订避世套餐！凭证短信已同步发送至手机。
                    </p>
                    
                    <div style={{ 
                      borderTop: '1px dashed rgba(76, 175, 80, 0.3)', 
                      paddingTop: '8px', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '3px', 
                      fontSize: '0.6rem', 
                      color: '#a5d6a7', 
                      textAlign: 'left' 
                    }}>
                      <div>🎫 <b>美团凭证码</b>：<span style={{ color: '#fff', fontFamily: 'monospace' }}>MT9986321{12 + index}</span></div>
                      <div>🚙 <b>开运自驾时段</b>：{deal.auspiciousHour.time} 临【{deal.auspiciousHour.label}】</div>
                    </div>

                    {/* 已付款后去美团验证详情 */}
                    <a
                      href={getMeituanSearchUrl(deal.hotel.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        marginTop: '10px',
                        width: '100%',
                        padding: '8px 10px',
                        background: 'linear-gradient(135deg, #FFD000, #FFA500)',
                        border: 'none',
                        color: '#000',
                        fontWeight: 'bold',
                        fontSize: '0.65rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        textDecoration: 'none',
                        cursor: 'pointer',
                        boxShadow: '0 4px 0 rgba(0,0,0,0.3)',
                        borderRadius: '0px'
                      }}
                    >
                      <span>🌐 唤醒美团 App 验证预约订单</span>
                    </a>

                    {/* 分享下载契约按钮 */}
                    <button
                      onClick={() => handleCaptureTicket(index)}
                      style={{
                        marginTop: '10px',
                        width: '100%',
                        padding: '6px 8px',
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: '#eae3d9',
                        fontSize: '0.58rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      <Download size={11} />
                      <span>📸 保存本契约至相册 (长图票根)</span>
                    </button>
                  </div>
                )}
              </div>

            </motion.div>
          )}

        </div>

        {/* 探索者头像 */}
        {isUser && (
          <div style={{
            flexShrink: 0,
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'var(--primary-dim)',
            border: '2px solid var(--primary)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            fontSize: '1.2rem',
            boxShadow: '0 0 8px rgba(226,181,83,0.3)'
          }}>
            🤠
          </div>
        )}

      </div>
    );
  };

  return (
    <div style={{ 
      display: 'flex',
      flexDirection: 'column',
      height: '100dvh', 
      background: 'radial-gradient(circle at center, #181320 0%, #09070c 100%)', 
      color: 'var(--text-primary)', 
      overflow: 'hidden',
      position: 'relative'
    }}>
      
      {/* 截图/截图状态指示蒙层 */}
      {isCapturing && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px'
        }}>
          <RefreshCw size={36} className="spinner-icon" style={{ animation: 'spin 1.5s linear infinite', color: theme.color }} />
          <div style={{ fontSize: '0.85rem', color: '#fff', fontFamily: 'var(--font-mystic)' }}>
            {captureProgress}
          </div>
        </div>
      )}

      {/* 顶部固定 HUD 导航栏 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '16px 20px', 
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        background: 'rgba(15, 11, 20, 0.85)',
        backdropFilter: 'blur(16px)',
        zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.3rem', textShadow: `0 0 6px ${theme.color}` }}>🌟</span>
          <div>
            <h2 className="font-mystic" style={{ color: '#fff', fontSize: '1.05rem', margin: 0, textAlign: 'left' }}>
              星耀AI <span style={{ color: theme.color, fontSize: '0.8rem', marginLeft: '4px' }}>时空探路祭司</span>
            </h2>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* 开运指示牌 */}
          <div style={{ 
            fontSize: '0.58rem', 
            background: theme.badgeBg, 
            color: theme.color, 
            border: `1px solid ${theme.color}`, 
            padding: '2px 6px',
            fontWeight: 'bold',
            borderRadius: '0px'
          }}>
            {luckyElement}命大吉
          </div>
          
          {/* 重置对话按钮 */}
          {hasUserMessages && (
            <button
              onClick={handleRestartChat}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '4px 8px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: 'var(--text-secondary)',
                fontSize: '0.65rem',
                cursor: 'pointer',
                borderRadius: '0px'
              }}
              title="重新编织出游心里话"
            >
              <Trash2 size={12} />
              <span>重启</span>
            </button>
          )}
        </div>
      </div>

      {/* 中部滚动聊天视窗 */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: '20px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
      }} className="no-scrollbar">
        
        {/* ========================================================
            1. EMPTY LANDING STATE: 完美的 AI 主视觉 (完全参考“漫旅”项目的极奢风格)
            ======================================================== */}
        {!hasUserMessages && (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'flex-start', 
            padding: '20px 0 30px 0',
            width: '100%',
            height: '100%',
            minHeight: '420px'
          }}>
            
            {/* 3D 旋转星盘主视觉 */}
            <div 
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center', 
                margin: '10px 0 25px 0', 
                position: 'relative',
                cursor: 'pointer'
              }}
              onMouseEnter={() => { setSpinSpeed(6); setIsCompassHovered(true); }}
              onMouseLeave={() => { setSpinSpeed(20); setIsCompassHovered(false); }}
            >
              {/* 星轨发光环 */}
              <div style={{
                position: 'absolute',
                width: '150px',
                height: '150px',
                borderRadius: '50%',
                border: '1px dashed rgba(226, 181, 83, 0.25)',
                boxShadow: `0 0 20px ${theme.glow}`,
                animation: 'spin 120s linear infinite'
              }} />

              {/* 3D 旋转星罗盘 */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: spinSpeed, ease: 'linear' }}
                style={{
                  width: '120px',
                  height: '120px',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, #1f1a29 0%, #0d0a14 100%)',
                  border: `3px double ${theme.color}`,
                  boxShadow: `inset 0 0 15px rgba(0,0,0,0.8), 4px 4px 0 rgba(0,0,0,0.5)`,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  position: 'relative'
                }}
              >
                {/* 刻度 */}
                <div style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  fontSize: '0.45rem',
                  fontFamily: 'var(--font-mystic)',
                  color: 'var(--text-muted)',
                  opacity: 0.5
                }}>
                  <span style={{ position: 'absolute', top: '4px', left: '50%', transform: 'translateX(-50%)' }}>子</span>
                  <span style={{ position: 'absolute', bottom: '4px', left: '50%', transform: 'translateX(-50%)' }}>午</span>
                  <span style={{ position: 'absolute', left: '4px', top: '50%', transform: 'translateY(-50%)' }}>卯</span>
                  <span style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)' }}>酉</span>
                </div>

                {/* 磁针 */}
                <div style={{
                  position: 'absolute',
                  width: '6px',
                  height: '80px',
                  transform: `rotate(${currentDir.angle}deg)`,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{
                    width: 0, height: 0,
                    borderLeft: '3.5px solid transparent',
                    borderRight: '3.5px solid transparent',
                    borderBottom: `12px solid ${theme.color}`,
                    filter: `drop-shadow(0 0 4px ${theme.color})`
                  }} />
                  <div style={{
                    width: '4px', height: '4px',
                    borderRadius: '50%', background: '#fff',
                    border: '1px solid var(--pixel-border-color)',
                    position: 'absolute', top: '50%', transform: 'translateY(-50%)'
                  }} />
                  <div style={{
                    width: 0, height: 0,
                    borderLeft: '3.5px solid transparent',
                    borderRight: '3.5px solid transparent',
                    borderTop: '12px solid rgba(255,255,255,0.1)'
                  }} />
                </div>

                {/* 居中五行字眼 */}
                <div className="font-mystic" style={{ fontSize: '0.9rem', color: theme.color, fontWeight: 'bold', textShadow: `${theme.color} 0 0 10px`, zIndex: 5 }}>
                  {luckyElement}
                </div>
              </motion.div>

              <div style={{ fontSize: '0.5rem', color: 'var(--text-muted)', marginTop: '8px', opacity: 0.6 }}>
                🧭 触摸星罗盘加速旋转
              </div>
            </div>

            {/* 仿 漫旅 MANLV 风格的迎新大字报 (带避世季2026徽章与中心文本框) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', padding: '0 10px', marginTop: '10px' }}>
              <div style={{ flex: 1, textAlign: 'left' }}>
                {/* 问候：早安/午安/晚安，曹同学 (带高还原度细节) */}
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px', fontFamily: 'var(--font-main)', opacity: 0.85 }}>
                  {getTimeGreeting(currentUser?.username || '探索者')}
                </div>
                
                {/* 大标题：你的避世开运之旅 正在编织中 */}
                <h1 className="font-mystic" style={{ 
                  fontSize: '2.1rem', 
                  lineHeight: '1.25', 
                  color: '#eae3d9', 
                  margin: '4px 0',
                  fontWeight: 'normal',
                  letterSpacing: '1px'
                }}>
                  你的避世开运之旅
                </h1>
                <h1 className="font-mystic" style={{ 
                  fontSize: '2.1rem', 
                  lineHeight: '1.25', 
                  color: '#eae3d9', 
                  margin: '4px 0 14px 0',
                  fontWeight: 'normal',
                  letterSpacing: '1px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  正在编织中 <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: theme.color, display: 'inline-block', boxShadow: `0 0 8px ${theme.glow}` }} />
                </h1>

                {/* 精美金色渐变分割线带小金圆点 */}
                <div style={{ 
                  height: '2px', 
                  background: `linear-gradient(90deg, ${theme.color} 0%, rgba(255,255,255,0.05) 100%)`, 
                  width: '90px',
                  marginBottom: '16px',
                  position: 'relative'
                }}>
                  <div style={{
                    position: 'absolute',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: theme.color,
                    top: '-2px',
                    right: '-3px',
                    boxShadow: `0 0 6px ${theme.glow}`
                  }} />
                </div>

                {/* 幸运五行与开运方位子文本 */}
                <div style={{ 
                  fontSize: '0.75rem', 
                  color: 'var(--text-secondary)', 
                  lineHeight: '1.5',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: 0.9
                }}>
                  <span style={{ color: theme.color }}>✦</span>
                  <span>幸运五行属【<b>{luckyElement}</b>】</span>
                  <span style={{ opacity: 0.3 }}>|</span>
                  <span>宜往【<b>{currentDir.dir.split(' ')[0]}</b>】出行</span>
                </div>
              </div>

              {/* 漫旅风格 top-right 黄金极奢微章 */}
              <div style={{
                background: 'rgba(226, 181, 83, 0.04)',
                border: '1.5px solid rgba(226, 181, 83, 0.25)',
                color: theme.color,
                fontSize: '0.62rem',
                padding: '4px 10px',
                borderRadius: '20px',
                fontFamily: 'var(--font-mystic)',
                fontWeight: 'bold',
                letterSpacing: '0.5px',
                boxShadow: `inset 0 0 6px ${theme.glow}`,
                flexShrink: 0,
                marginTop: '4px'
              }}>
                避世季 2026
              </div>
            </div>

            {/* 图2风格的中心高画质圆角对话文本输入框 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1.5px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '28px',
              padding: '8px 10px 8px 12px',
              width: '95%',
              maxWidth: '430px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
              backdropFilter: 'blur(12px)',
              marginTop: '32px',
              transition: 'border-color 0.2s',
              position: 'relative'
            }}
            onFocusCapture={(e) => e.currentTarget.style.borderColor = theme.color}
            onBlurCapture={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
            >
              {/* 左侧带 themed 背景的精致机器人图标框 */}
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: theme.badgeBg,
                border: `1px solid ${theme.color}`,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                fontSize: '1.15rem',
                marginRight: '12px',
                flexShrink: 0,
                boxShadow: `0 0 6px ${theme.glow}`
              }}>
                🔮
              </div>

              {/* 真实输入框 */}
              <input
                type="text"
                placeholder="倾诉任何具体的出行、避世宿命需求..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSendMessage();
                  }
                }}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#fff',
                  fontSize: '0.82rem',
                  fontFamily: 'var(--font-main)'
                }}
              />

              {/* 右侧圆圈发送箭头按钮 */}
              <button
                disabled={isLoading || !inputValue.trim()}
                onClick={() => handleSendMessage()}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  background: inputValue.trim() ? `linear-gradient(135deg, ${theme.color}, ${theme.accent})` : 'rgba(255,255,255,0.06)',
                  border: 'none',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  color: inputValue.trim() ? '#000' : 'rgba(255,255,255,0.3)',
                  cursor: inputValue.trim() ? 'pointer' : 'default',
                  transition: 'all 0.2s',
                  flexShrink: 0,
                  outline: 'none'
                }}
              >
                <ChevronRight size={18} />
              </button>
            </div>

          </div>
        )}

        {/* ========================================================
            2. CONVERSATIONAL DIALOG THREAD: 活动对话区
            ======================================================== */}
        {hasUserMessages && messages.map(renderMessage)}

        {/* 动态输入加载指示器 */}
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: '10px', padding: '0 4px', marginBottom: '20px' }}>
            <div style={{
              width: '36px', height: '36px',
              borderRadius: '50%', background: 'var(--primary-dim)',
              border: `2px solid ${theme.color}`,
              display: 'flex', justifyContent: 'center', alignItems: 'center',
              fontSize: '1.2rem', boxShadow: `0 0 6px ${theme.glow}`
            }}>
              🧙‍♂️
            </div>
            <div className="pixel-panel" style={{ padding: '10px 14px', background: 'var(--bg-card)', color: theme.color, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RefreshCw size={12} className="spinner-icon" style={{ animation: 'spin 1.5s linear infinite' }} />
              <span>探路祭司正在编织运势脑波...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 底部固定聊天输入底槽 (当用户已经开启对话后才显示) */}
      <AnimatePresence>
        {hasUserMessages && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            style={{ 
              padding: '12px 16px 16px 16px', 
              marginBottom: '80px', // Shift up by 80px to sit perfectly above the fixed navigation bar
              borderTop: '1px solid rgba(255,255,255,0.05)',
              background: 'rgba(9, 7, 12, 0.95)',
              boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              zIndex: 100
            }}
          >
            <textarea
              placeholder="向时空探路祭司倾诉你的出行心里话..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              rows={1}
              style={{
                flex: 1,
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid var(--pixel-border-color)',
                color: '#fff',
                padding: '12px 14px',
                fontSize: '0.8rem',
                outline: 'none',
                fontFamily: 'var(--font-main)',
                resize: 'none',
                boxShadow: 'inset 2px 2px 0 rgba(0,0,0,0.3)',
                borderRadius: '0px',
                maxHeight: '80px',
                lineHeight: '1.4'
              }}
            />

            <button
              className="btn btn-primary"
              disabled={isLoading || !inputValue.trim()}
              onClick={() => handleSendMessage()}
              style={{
                padding: '12px',
                background: inputValue.trim() ? `linear-gradient(45deg, ${theme.color}, ${theme.accent})` : '#333',
                border: 'none',
                color: inputValue.trim() ? '#000' : '#888',
                boxShadow: inputValue.trim() ? `0 2px 0px rgba(0,0,0,0.4)` : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '0px',
                cursor: inputValue.trim() ? 'pointer' : 'default',
                outline: 'none'
              }}
            >
              <Send size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
