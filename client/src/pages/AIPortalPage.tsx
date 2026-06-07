import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Compass, Sparkles, Wand2, Clock, MapPin, CheckCircle, Navigation, Info, ChevronRight, ChevronLeft, User, Send, RefreshCw, Trash2, Download, Share2, Train, Plane, Ticket } from 'lucide-react';
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

const CouponWidget = () => {
  const [step, setStep] = useState<number>(0);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [couponResult, setCouponResult] = useState<any>(null);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [dailyReminder, setDailyReminder] = useState(false);
  const [focusInput, setFocusInput] = useState<string>('');

  useEffect(() => {
    const accepted = localStorage.getItem('coupon_terms_accepted');
    if (accepted === 'true') {
      setStep(1);
      checkToken();
    }
  }, []);

  const checkToken = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/agent/coupon/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'token-verify' })
      });
      const data = await res.json();
      if (data.valid && data.user_token) {
        setStep(2);
        issueCoupon(data.user_token);
      } else {
        const savedPhone = localStorage.getItem('coupon_phone_masked');
        if (savedPhone) setMessage(`上次验证手机号为 ${savedPhone}，请输入完整手机号继续`);
        setStep(1);
      }
    } catch(e:any) {
      setMessage(e.message);
    }
    setLoading(false);
  };

  const handleAgree = () => {
    localStorage.setItem('coupon_terms_accepted', 'true');
    setStep(1);
    checkToken();
  };

  const handleSendSms = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/agent/coupon/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send-sms', phone })
      });
      const data = await res.json();
      if (data.error) {
         setMessage(data.message || data.error);
         if (data.error === 'SMS_SECURITY_VERIFY_REQUIRED' && data.redirect_url) {
            setMessage(`请先进行安全验证: ${data.redirect_url}`);
         }
      } else {
         setMessage('验证码已发送至您的手机');
         setShowCodeInput(true);
      }
    } catch(e:any) {
      setMessage(e.message);
    }
    setLoading(false);
  };

  const handleVerify = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/agent/coupon/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', phone, code })
      });
      const data = await res.json();
      if (data.error) {
         setMessage(data.message || data.error);
      } else if ((data.valid || data.success) && data.user_token) {
         localStorage.setItem('coupon_phone_masked', phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'));
         setStep(2);
         issueCoupon(data.user_token);
      }
    } catch(e:any) {
      setMessage(e.message);
    }
    setLoading(false);
  };

  const issueCoupon = async (token: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/agent/coupon/issue', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      setCouponResult(data);
      setStep(3);
    } catch(e:any) {
      setMessage(e.message);
    }
    setLoading(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98, y: 10 }} 
      animate={{ opacity: 1, scale: 1, y: 0 }} 
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={{ 
        marginTop: '20px', 
        padding: '16px', 
        background: 'rgba(20, 15, 25, 0.65)', 
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(226, 181, 83, 0.4)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 0 20px rgba(226, 181, 83, 0.05)',
        color: '#fff', 
        fontSize: '0.85rem', 
        borderRadius: '16px',
        boxSizing: 'border-box'
      }}>
      
      <h3 style={{ 
        color: '#FFDF8D', 
        marginTop: 0, 
        marginBottom: '20px', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px',
        fontSize: '1.15rem',
        textShadow: '0 0 12px rgba(226, 181, 83, 0.6)',
        letterSpacing: '0.5px'
      }}>
        <Sparkles size={20} color="#FFDF8D" /> 美团专属隐藏福袋
      </h3>
      
      {step === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <p style={{ lineHeight: '1.6', fontSize: '0.9rem', marginBottom: '12px' }}>
            🎉 欢迎开启美团专属隐藏红包通道！<br/>
            此处领取的福利<span style={{ color: '#E2B553', fontWeight: 'bold' }}>面额更大、覆盖更广</span>。领完即可一键直达美团 App 专属会场使用。<br/>
            (注：手机号与登录凭证经过多重加密，仅保留在您的设备本地。)
          </p>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', lineHeight: '1.4' }}>
            继续使用即代表您已充分理解并同意《Skills服务使用规则》以及《美团用户服务协议》《隐私政策》的全部内容，且自愿接受该等规则约束。
          </p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <motion.button 
              whileHover={{ scale: 1.02 }} 
              whileTap={{ scale: 0.95 }}
              onClick={handleAgree} 
              style={{ 
                padding: '10px 24px', 
                background: 'linear-gradient(135deg, #FFDF8D 0%, #D4AF37 100%)', 
                color: '#111', 
                border: 'none', 
                borderRadius: '8px', 
                cursor: 'pointer', 
                fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(226, 181, 83, 0.4)'
              }}>
              同意并立即开启
            </motion.button>
          </div>
        </motion.div>
      )}

      {step === 1 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ color: 'rgba(255,255,255,0.85)', lineHeight: '1.5' }}>
            即将为您注入福袋之力。<br/>
            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>请先进行美团时空印记（手机号）验证，凭证将完全在本地沙箱加密保存。</span>
          </p>
          
          <AnimatePresence>
            {message && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ color: '#FFDF8D', fontSize: '0.75rem', background: 'rgba(226, 181, 83, 0.1)', padding: '8px 12px', borderRadius: '6px', borderLeft: '3px solid #E2B553' }}>
                {message}
              </motion.div>
            )}
          </AnimatePresence>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
            <input 
              type="text" 
              placeholder="请输入11位手机号" 
              value={phone} 
              onChange={e => setPhone(e.target.value)}
              onFocus={() => setFocusInput('phone')}
              onBlur={() => setFocusInput('')}
              style={{ 
                flex: 1, minWidth: 0, width: '100%', height: '44px', padding: '12px 12px', background: 'rgba(0,0,0,0.3)', 
                border: focusInput === 'phone' ? '1px solid #FFDF8D' : '1px solid rgba(226, 181, 83, 0.3)', 
                color: '#FFDF8D', borderRadius: '8px', outline: 'none', transition: 'all 0.3s',
                boxSizing: 'border-box',
                boxShadow: focusInput === 'phone' ? '0 0 8px rgba(226, 181, 83, 0.2)' : 'none'
              }}
              disabled={showCodeInput || loading}
            />
            {!showCodeInput && (
              <motion.button 
                whileHover={phone ? { scale: 1.02 } : {}} whileTap={phone ? { scale: 0.95 } : {}}
                onClick={handleSendSms} disabled={loading || !phone} 
                style={{ 
                  height: '44px', padding: '0 12px', fontSize: '0.8rem',
                  background: phone ? 'linear-gradient(135deg, #FFDF8D 0%, #D4AF37 100%)' : 'rgba(255,255,255,0.1)', 
                  color: phone ? '#111' : 'rgba(255,255,255,0.3)', 
                  border: 'none', borderRadius: '8px', cursor: phone ? 'pointer' : 'not-allowed', 
                  fontWeight: 'bold', whiteSpace: 'nowrap', transition: 'all 0.3s',
                  boxSizing: 'border-box',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                {loading ? '获取中...' : '获取验证码'}
              </motion.button>
            )}
          </div>
          
          {showCodeInput && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', gap: '12px', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
              <input 
                type="text" 
                placeholder="请输入6位短信验证码" 
                value={code} 
                onChange={e => setCode(e.target.value)}
                onFocus={() => setFocusInput('code')}
                onBlur={() => setFocusInput('')}
                style={{ 
                  flex: 1, minWidth: 0, width: '100%', height: '44px', padding: '12px 12px', background: 'rgba(0,0,0,0.3)', 
                  border: focusInput === 'code' ? '1px solid #FFDF8D' : '1px solid rgba(226, 181, 83, 0.3)', 
                  color: '#FFDF8D', borderRadius: '8px', outline: 'none', transition: 'all 0.3s',
                  boxSizing: 'border-box',
                  boxShadow: focusInput === 'code' ? '0 0 8px rgba(226, 181, 83, 0.2)' : 'none'
                }}
                disabled={loading}
              />
              <motion.button 
                whileHover={code ? { scale: 1.02 } : {}} whileTap={code ? { scale: 0.95 } : {}}
                onClick={handleVerify} disabled={loading || !code} 
                style={{ 
                  height: '44px', padding: '0 12px', fontSize: '0.8rem',
                  background: code ? 'linear-gradient(135deg, #FFDF8D 0%, #D4AF37 100%)' : 'rgba(255,255,255,0.1)', 
                  color: code ? '#111' : 'rgba(255,255,255,0.3)', 
                  border: 'none', borderRadius: '8px', cursor: code ? 'pointer' : 'not-allowed', 
                  fontWeight: 'bold', whiteSpace: 'nowrap', transition: 'all 0.3s',
                  boxSizing: 'border-box',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                {loading ? '校验中...' : '确认开启'}
              </motion.button>
            </motion.div>
          )}
        </motion.div>
      )}

      {step === 2 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '20px 0' }}>
          <div style={{ position: 'relative' }}>
            <Compass size={40} color="#FFDF8D" style={{ animation: 'spin 2s linear infinite' }} />
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '60px', height: '60px', borderRadius: '50%', border: '2px dashed rgba(226, 181, 83, 0.5)', animation: 'spin 4s linear infinite reverse' }} />
          </div>
          <span style={{ color: '#FFDF8D', fontWeight: 'bold', letterSpacing: '1px' }}>正在为您向美团总库请求专属大额福利...</span>
        </motion.div>
      )}

      {step === 3 && couponResult && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {couponResult.success && couponResult.coupon_count > 0 ? (
            <div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', background: 'linear-gradient(90deg, #4caf50, #81c784)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={22} color="#4caf50" /> 成功获得 {couponResult.coupon_count} 张专属神券！
              </div>
              
              {/* 世界级美团金卡 UI */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {couponResult.coupons?.map((c:any, i:number) => (
                  <motion.div 
                    key={i} 
                    whileHover={{ scale: 1.02, y: -2 }}
                    style={{ 
                      background: 'linear-gradient(135deg, #FFF8E1 0%, #F4D03F 30%, #D4AC0D 70%, #F9E79F 100%)', 
                      backgroundSize: '200% auto',
                      animation: 'gradientFlow 4s ease infinite',
                      borderRadius: '12px', 
                      padding: '18px 20px', 
                      color: '#3A2703', 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      boxShadow: '0 6px 20px rgba(212, 172, 13, 0.3), inset 0 1px 1px rgba(255,255,255,0.8)',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    {/* 卡券两侧的半圆打孔装饰 */}
                    <div style={{ position: 'absolute', left: '-10px', width: '20px', height: '20px', borderRadius: '50%', background: '#1c1524', boxShadow: 'inset -2px 0 4px rgba(0,0,0,0.3)' }} />
                    <div style={{ position: 'absolute', right: '-10px', width: '20px', height: '20px', borderRadius: '50%', background: '#1c1524', boxShadow: 'inset 2px 0 4px rgba(0,0,0,0.3)' }} />
                    
                    {/* 卡券发光扫光动画层 (通过CSS注入，见外层) */}
                    
                    <div style={{ zIndex: 1, paddingLeft: '8px', maxWidth: '65%' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: '900', letterSpacing: '0.5px', textShadow: '0 1px 1px rgba(255,255,255,0.6)' }}>
                        {c.name}
                      </div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 'bold', opacity: 0.85, marginTop: '4px', background: 'rgba(58, 39, 3, 0.1)', display: 'inline-block', padding: '2px 8px', borderRadius: '4px' }}>
                        {c.discount_info}
                      </div>
                    </div>
                    <div style={{ zIndex: 1, textAlign: 'right', paddingRight: '8px', borderLeft: '1px dashed rgba(58, 39, 3, 0.2)', paddingLeft: '14px', minWidth: '35%' }}>
                      <div style={{ fontSize: '0.7rem', opacity: 0.7, fontWeight: 'bold' }}>有效期至</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 'bold', fontFamily: 'monospace', marginTop: '2px', whiteSpace: 'nowrap' }}>
                        {c.valid_period?.split(' ')[0]}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.3)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(226, 181, 83, 0.2)' }}>
                <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)' }}>🛍️ 券已自动入账！</span>
                <motion.a 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  href="https://click.meituan.com/t?t=1&c=2&p=Zcjq1Lxzawjj" 
                  target="_blank" 
                  rel="noreferrer" 
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '4px',
                    padding: '8px 16px', background: 'linear-gradient(90deg, #FF9800, #FF5722)', 
                    color: '#fff', textDecoration: 'none', borderRadius: '20px', 
                    fontSize: '0.85rem', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(255, 152, 0, 0.4)' 
                  }}
                >
                  去美团使用 <ChevronRight size={16} />
                </motion.a>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '0.95rem', color: '#ff9800', background: 'rgba(255, 152, 0, 0.1)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255, 152, 0, 0.3)' }}>
              {couponResult.code === 1014 ? '🌟 今天您已经领取过专属红包啦！可以直接去美团 App 尽情挑选心水商品哦。' : (couponResult.msg || '当前美团专属红包暂未上新，请晚些再来。')}
            </div>
          )}

          {couponResult.activity_name && (
            <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} style={{ background: 'rgba(255, 223, 141, 0.1)', border: '1px solid rgba(255, 223, 141, 0.3)', padding: '14px 16px', borderRadius: '12px', marginTop: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>🔥 专属高优会场推荐</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold', color: '#FFDF8D', fontSize: '1.05rem' }}>{couponResult.activity_name}</span>
                {couponResult.activity_link && (
                  <a href={couponResult.activity_link} target="_blank" rel="noreferrer" style={{ color: '#FFDF8D', textDecoration: 'none', fontSize: '0.85rem', display: 'flex', alignItems: 'center', background: 'rgba(226, 181, 83, 0.2)', padding: '4px 10px', borderRadius: '12px' }}>前往参与 <ChevronRight size={14} /></a>
                )}
              </div>
            </motion.div>
          )}

          {/* Step 4: 提醒功能 */}
          <div style={{ borderTop: '1px dashed rgba(255,255,255,0.15)', marginTop: '16px', paddingTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.8)' }}>
              <Clock size={16} color="#FFDF8D" /> 
              <span>每天 10:00 自动提醒我领大额红包</span>
            </div>
            <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px' }}>
              <input type="checkbox" checked={dailyReminder} onChange={(e) => {
                setDailyReminder(e.target.checked);
                if (e.target.checked) alert('✅ 已为您开启星轨提醒！每天 10:00 准时播报福袋状态。');
                else alert('已取消每日提醒。');
              }} style={{ opacity: 0, width: 0, height: 0 }} />
              <span style={{
                position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: dailyReminder ? '#4caf50' : 'rgba(255,255,255,0.2)',
                transition: '.4s', borderRadius: '24px'
              }}>
                <span style={{
                  position: 'absolute', content: '""', height: '18px', width: '18px',
                  left: dailyReminder ? '22px' : '3px', bottom: '3px',
                  backgroundColor: 'white', transition: '.4s', borderRadius: '50%'
                }} />
              </span>
            </label>
          </div>
        </motion.div>
      )}

      {/* 注入全局动画样式 */}
      <style>{`
        @keyframes gradientFlow {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </motion.div>
  );
};

interface LoadingStepsPanelProps {
  theme: any;
  isLoading: boolean;
}

const LoadingStepsPanel = ({ theme, isLoading }: LoadingStepsPanelProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const steps = [
    { title: '理解宿命任务', desc: '已解析您的出行意图与星盘时空方位', activeDesc: '正在分析您的出游场景与上下文...' },
    { title: '唤醒美团星轨', desc: '已成功连接美团即时生活导购星轨', activeDesc: '正在检索美团精选商家与专属特惠...' },
    { title: '推演天命行程', desc: '已为您定制吃喝玩乐一体化出行契约', activeDesc: '正在编排最佳出行路线与时间组合...' },
    { title: '编织运势脑波', desc: '时空箴言已编织完成，正在召来', activeDesc: '正在润色祭司箴言与避世开运契约...' }
  ];

  useEffect(() => {
    if (!isLoading) {
      setCurrentStep(4);
      return;
    }

    setCurrentStep(0);

    const t1 = setTimeout(() => {
      setCurrentStep(1);
    }, 800);

    const t2 = setTimeout(() => {
      setCurrentStep(2);
    }, 1800);

    const t3 = setTimeout(() => {
      setCurrentStep(3);
    }, 3000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isLoading]);

  const getStepStatus = (index: number) => {
    if (currentStep > index) return 'done';
    if (currentStep === index) return 'active';
    return 'pending';
  };

  const completedCount = Math.min(currentStep, 4);

  return (
    <div 
      className="pixel-panel" 
      style={{ 
        flex: 1,
        width: '100%',
        boxSizing: 'border-box',
        background: 'var(--bg-card)', 
        border: '1px solid var(--pixel-border-color)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        userSelect: 'none',
        WebkitUserSelect: 'none'
      }}
    >
      {/* 标题栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="font-mystic" style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
          🔮 祭司推演过程
        </span>
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{
            background: 'none',
            border: 'none',
            color: theme.color,
            fontSize: '0.7rem',
            cursor: 'pointer',
            padding: '2px 6px',
            outline: 'none',
            fontFamily: 'var(--font-main)',
            textDecoration: 'underline'
          }}
        >
          {isCollapsed ? '展开' : '收起'}
        </button>
      </div>

      {/* 进度说明 */}
      <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textAlign: 'left', marginTop: '-4px' }}>
        {completedCount === 4 ? '推演已全部完成' : `已完成 ${completedCount} / 4 步`}
      </div>

      {/* 步骤列表 */}
      {!isCollapsed && (
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '6px', paddingLeft: '4px' }}>
          
          {/* 连接线 */}
          <div style={{
            position: 'absolute',
            left: '11px',
            top: '8px',
            bottom: '8px',
            width: '2px',
            background: 'rgba(255,255,255,0.06)',
            zIndex: 0
          }} />

          {/* 动态连接线 */}
          <div style={{
            position: 'absolute',
            left: '11px',
            top: '8px',
            height: `${Math.max(0, completedCount - 1) * 33.3}%`,
            width: '2px',
            background: `linear-gradient(180deg, ${theme.color} 0%, ${completedCount === 4 ? theme.color : theme.accent || theme.color} 100%)`,
            boxShadow: `0 0 4px ${theme.glow}`,
            transition: 'height 0.5s ease',
            zIndex: 0
          }} />

          {steps.map((step, index) => {
            const status = getStepStatus(index);
            const isDone = status === 'done';
            const isActive = status === 'active';
            const isPending = status === 'pending';

            return (
              <div key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', zIndex: 1 }}>
                
                {/* 节点图标 */}
                <div style={{ 
                  width: '16px', 
                  height: '16px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '2px'
                }}>
                  {isDone ? (
                    <div style={{ 
                      width: '8px', 
                      height: '8px', 
                      borderRadius: '50%', 
                      background: theme.color, 
                      boxShadow: `0 0 8px ${theme.glow}`,
                      transition: 'all 0.3s'
                    }} />
                  ) : isActive ? (
                    <RefreshCw size={10} className="spinner-icon" style={{ animation: 'spin 1.5s linear infinite', color: theme.color }} />
                  ) : (
                    <div style={{ 
                      width: '6px', 
                      height: '6px', 
                      borderRadius: '50%', 
                      background: 'rgba(255,255,255,0.15)'
                    }} />
                  )}
                </div>

                {/* 文本内容 */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <div style={{ 
                    fontSize: '0.75rem', 
                    fontWeight: 'bold', 
                    color: isPending ? 'rgba(255,255,255,0.3)' : '#fff',
                    transition: 'color 0.3s'
                  }}>
                    {step.title}
                  </div>
                  <div style={{ 
                    fontSize: '0.65rem', 
                    color: isActive ? theme.color : isPending ? 'rgba(255,255,255,0.2)' : 'var(--text-secondary)',
                    marginTop: '2px',
                    textAlign: 'left',
                    transition: 'color 0.3s'
                  }}>
                    {isActive ? step.activeDesc : step.desc}
                  </div>
                </div>

                {/* 状态文字 */}
                <div style={{ 
                  fontSize: '0.65rem', 
                  color: isDone ? '#3CD070' : isActive ? theme.color : 'rgba(255,255,255,0.2)',
                  fontWeight: isActive ? 'bold' : 'normal',
                  flexShrink: 0
                }}>
                  {isDone ? '已完成' : isActive ? '推演中...' : '等待中'}
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const AIPortalPage = () => {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();

  // 补全真实美团 App 唤醒跳转链接生成器
  const getMeituanSearchUrl = (keyword: string) => {
    // 过滤掉 emoji 字符，如 🏨 或 🏕️
    const cleanKeyword = keyword.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDC00-\uDFFF]/g, '').trim();
    // 检测是否为移动端环境
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
      // 优先通过 URL Scheme (imeituan://) 直接拉起美团 App 的全局搜索页
      return `imeituan://www.meituan.com/search?q=${encodeURIComponent(cleanKeyword)}`;
    }
    return `https://i.meituan.com/s/${encodeURIComponent(cleanKeyword)}`;
  };

  // 1. 判断玄学大结界基础参数
  const [luckyElement, setLuckyElement] = useState('金');
  const [mainElement, setMainElement] = useState('水');
  
  // 罗盘动画控制与交互
  const [spinSpeed, setSpinSpeed] = useState(20); // 慢速自动转
  const [isCompassHovered, setIsCompassHovered] = useState(false);

  // ==========================================
  // 美团生活服务导购 Skill 交互状态机
  // ==========================================
  const [showVenueWidget, setShowVenueWidget] = useState(false);
  const [venueBindStatus, setVenueBindStatus] = useState<{ valid: boolean; reason?: string } | null>(null);
  const [venueLinks, setVenueLinks] = useState<Array<{ tenantName: string; link: string }>>([]);
  const [venueWidgetStep, setVenueWidgetStep] = useState(0); // 0: agreement, 1: qrcode, 2: codeWord, 3: success
  const [venueAuthUrl, setVenueAuthUrl] = useState('');
  const [venueQrCodeUrl, setVenueQrCodeUrl] = useState('');
  const [venueCodeWord, setVenueCodeWord] = useState('');
  const [venueUserToken, setVenueUserToken] = useState('');
  const [venueLoading, setVenueLoading] = useState(false);
  const [venueError, setVenueError] = useState('');

  // 检查绑定状态
  const checkVenueStatus = async () => {
    try {
      const baseUrl = import.meta.env.VITE_BACKEND_URL || window.location.origin;
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/agent/venue/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      setVenueBindStatus(data);
      if (data.valid) {
        // 获取会场链接列表
        const linksRes = await fetch(`${baseUrl.replace(/\/$/, '')}/api/agent/venue/links`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const linksData = await linksRes.json();
        if (linksData.success) {
          setVenueLinks(linksData.links || []);
        }
      } else {
        setVenueLinks([]);
      }
    } catch (err) {
      console.error('Failed to check venue status:', err);
    }
  };

  useEffect(() => {
    checkVenueStatus();
  }, []);

  // 自动激活绑定 (将原本需要用户手动输入口令的 Step 2 改为自动使用 Mock 口令 123456 进行后台激活)
  const handleVerifyBind = async (tokenToBind?: string) => {
    const activeToken = tokenToBind || venueUserToken;
    if (!activeToken) {
      setVenueError('缺少授权 Token');
      return;
    }
    setVenueLoading(true);
    setVenueError('');
    try {
      const baseUrl = import.meta.env.VITE_BACKEND_URL || window.location.origin;
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/agent/venue/bind`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: activeToken, codeWord: '123456' })
      });
      const data = await res.json();
      if (data.success) {
        setVenueWidgetStep(3); // 成功阶段
        await checkVenueStatus(); // 重新加载状态和链接
      } else {
        setVenueError(data.message || '口令激活失败，请检查并重试');
      }
    } catch (err) {
      setVenueError('口令绑定失败，请稍后重试 🔧');
    } finally {
      setVenueLoading(false);
    }
  };

  // 扫码授权轮询
  useEffect(() => {
    let timer: any = null;
    if (showVenueWidget && venueWidgetStep === 1) {
      const baseUrl = import.meta.env.VITE_BACKEND_URL || window.location.origin;
      
      timer = setInterval(async () => {
        try {
          const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/agent/venue/auth/poll`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          const data = await res.json();
          if (data.success && data.status === 'authorized' && data.token) {
            clearInterval(timer);
            setVenueUserToken(data.token);
            // 授权成功，直接自动激活绑定，不展示输入口令页面
            await handleVerifyBind(data.token);
          }
        } catch (err) {
          console.error('Polling auth error:', err);
        }
      }, 3000);
    }
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [showVenueWidget, venueWidgetStep, venueUserToken]);

  // 启动授权流程 (Step 0 -> Step 1 或 自动绑定)
  const handleStartAuth = async () => {
    setVenueLoading(true);
    setVenueError('');
    try {
      const baseUrl = import.meta.env.VITE_BACKEND_URL || window.location.origin;
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/agent/venue/auth/get-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        if (data.token) {
          // 缓存命中了已授权的 Token，直接自动激活绑定
          setVenueUserToken(data.token);
          await handleVerifyBind(data.token);
        } else if (data.authUrl) {
          setVenueAuthUrl(data.authUrl);
          setVenueQrCodeUrl(data.qrCodeUrl || '');
          setVenueWidgetStep(1); // 扫码阶段
        }
      } else {
        setVenueError(data.error || '获取授权二维码失败，请重试');
      }
    } catch (err) {
      setVenueError('网络开小差了，请稍候重试 🔧');
    } finally {
      setVenueLoading(false);
    }
  };

  // 退出登录
  const handleVenueLogout = async () => {
    if (!window.confirm('确认退出美团生活服务导购助手登录吗？这将清除本地口令数据。')) return;
    setVenueLoading(true);
    try {
      const baseUrl = import.meta.env.VITE_BACKEND_URL || window.location.origin;
      await fetch(`${baseUrl.replace(/\/$/, '')}/api/agent/venue/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      // 清空状态
      setVenueBindStatus(null);
      setVenueLinks([]);
      setVenueUserToken('');
      setVenueCodeWord('');
      setVenueAuthUrl('');
      setVenueQrCodeUrl('');
      setVenueWidgetStep(0);
      setShowVenueWidget(false);
      await checkVenueStatus();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setVenueLoading(false);
    }
  };

  // 2. AI 对话聊天历史与输入管理
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant', content: string }>>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // 记录每个消息卡片的多路 Booking 预订状态和截屏状态
  const [bookingSuccessMap, setBookingSuccessMap] = useState<Record<number, boolean>>({});
  const [sharedSuccessMap, setSharedSuccessMap] = useState<Record<number, boolean>>({});
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureProgress, setCaptureProgress] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isSendingRef = useRef(false);

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
    if (!textToSend.trim() || isLoading || isSendingRef.current) return;

    // 如果包含美团生活服务导购意图，且尚未激活绑定，自动滑出弹窗
    const isVenueIntent = /外卖|送餐|配送|叫餐|奶茶|咖啡|下午茶|宵夜|早餐|午餐|晚餐|超市|便利店|鲜花|买花|水果|食材|零食|买酒|啤酒|饮料|美妆|日用品|数码|母婴|宠物|即时配送|堂食|团购|代金券|火锅|烧烤|餐厅|聚餐|约饭|餐饮团购|KTV|K歌|唱歌|电影|健身|洗浴|按摩|足疗|美甲|美睫|美发|剪头发|洗车|保养|摄影|亲子|游乐园|剧本杀|买药|送药|药店|药品|处方药|感冒药|退烧药|退热/.test(textToSend);
    if (isVenueIntent && !venueBindStatus?.valid) {
      setVenueWidgetStep(0);
      setShowVenueWidget(true);
    }

    isSendingRef.current = true;
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
      
      const { fetchSSEJSON } = await import('../lib/fetchSSE');
      
      // Initialize an empty response so we can stream into it
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      
      const resData = await fetchSSEJSON(
        `${baseUrl.replace(/\/$/, '')}/api/agent/chat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: chatHistory,
            luckyElement,
            city: '', // 由后端依据对话上下文或定位推理，不应使用出生地
            username: currentUser?.username || '探索者',
            boundMembers: getBoundMembers(),
            venueLinks
          })
        },
        (chunkText) => {
          setMessages(prev => {
            const newMsgs = [...prev];
            const lastMsg = { ...newMsgs[newMsgs.length - 1] };
            if (lastMsg.role === 'assistant') {
              lastMsg.content += chunkText;
              newMsgs[newMsgs.length - 1] = lastMsg;
            }
            return newMsgs;
          });
        }
      );

      if (!resData.success || !resData.reply) {
        throw new Error(resData.error || '解析出游契约答复失败');
      }

      setMessages(prev => {
        const newMsgs = [...prev];
        const lastMsg = { ...newMsgs[newMsgs.length - 1] };
        if (lastMsg.role === 'assistant') {
          lastMsg.content = resData.reply;
          newMsgs[newMsgs.length - 1] = lastMsg;
        }
        return newMsgs;
      });
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
      isSendingRef.current = false;
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

  // 辅助 JSON 解析器 (扫描 XML 标签，支持 travel_deal, ticket_deal, weekend_deal 和 coupon_deal)
  const parseMessageContent = (text: string) => {
    const dealRegex = /<travel_deal>([\s\S]*?)<\/travel_deal>/;
    const ticketRegex = /<ticket_deal>([\s\S]*?)<\/ticket_deal>/;
    const weekendRegex = /<weekend_deal>([\s\S]*?)<\/weekend_deal>/;
    const couponRegex = /<coupon_deal>([\s\S]*?)<\/coupon_deal>/;

    let textWithoutDeals = text;
    let deal = null;
    let ticketDeal = null;
    let weekendDeal = null;
    let couponDeal = null;

    const dealMatch = text.match(dealRegex);
    if (dealMatch) {
      const rawJson = dealMatch[1].trim();
      textWithoutDeals = textWithoutDeals.replace(dealRegex, '').trim();
      try { deal = JSON.parse(rawJson); } catch (e) {}
    }

    const ticketMatch = text.match(ticketRegex);
    if (ticketMatch) {
      const rawJson = ticketMatch[1].trim();
      textWithoutDeals = textWithoutDeals.replace(ticketRegex, '').trim();
      try { ticketDeal = JSON.parse(rawJson); } catch (e) {}
    }

    const weekendMatch = text.match(weekendRegex);
    if (weekendMatch) {
      const rawJson = weekendMatch[1].trim();
      textWithoutDeals = textWithoutDeals.replace(weekendRegex, '').trim();
      try { weekendDeal = JSON.parse(rawJson); } catch (e) {}
    }

    const couponMatch = text.match(couponRegex);
    if (couponMatch) {
      const rawJson = couponMatch[1].trim();
      textWithoutDeals = textWithoutDeals.replace(couponRegex, '').trim();
      try { couponDeal = JSON.parse(rawJson); } catch (e) {}
    }

    return { text: textWithoutDeals, deal, ticketDeal, weekendDeal, couponDeal };
  };

  // AI PM 对齐反馈日志推送：将优质样本（如用户保存图片、一键预订）记录为对齐数据飞轮
  const sendPMFeedback = async (index: number, feedbackType: 'positive_booking' | 'positive_capture') => {
    try {
      const baseUrl = import.meta.env.VITE_BACKEND_URL || window.location.origin;
      const userMsg = messages[index - 1]?.content || '';
      const aiMsg = messages[index]?.content || '';
      await fetch(`${baseUrl.replace(/\/$/, '')}/api/agent/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedbackType,
          query: userMsg,
          reply: aiMsg
        })
      });
      console.log(`[AI PM Alignment Data Loop] Push successful for type=${feedbackType}`);
    } catch (e) {
      console.error('Failed to send PM feedback:', e);
    }
  };

  // 预订成功触发
  const handleConfirmBooking = (index: number) => {
    setBookingSuccessMap(prev => ({
      ...prev,
      [index]: true
    }));
    sendPMFeedback(index, 'positive_booking');
  };

  // 模拟分享给老婆/朋友并收到反馈
  const handleShareWeekendPlan = (index: number) => {
    setIsCapturing(true);
    setCaptureProgress('✨ 正在传送时空阵纹...');
    
    setTimeout(() => {
      setSharedSuccessMap(prev => ({
        ...prev,
        [index]: true
      }));
      setIsCapturing(false);
      setCaptureProgress('');

      // 模拟收到家属/朋友回复
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: '【时空回响】您的结界成员已查收并回复：“这个减脂餐厅看着不错，游乐园也适合宝宝，同意安排！”'
        }
      ]);
    }, 1500);
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
        sendPMFeedback(index, 'positive_capture');
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

  // 解析 Markdown 链接和粗体语法为 React 组件
  const renderTextWithLinks = (content: string) => {
    if (!content) return null;
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    const parseBold = (str: string, baseKey: number) => {
      const boldRegex = /\*\*([^*]+)\*\*/g;
      const boldParts: React.ReactNode[] = [];
      let lastIdx = 0;
      let boldMatch;

      while ((boldMatch = boldRegex.exec(str)) !== null) {
        if (boldMatch.index > lastIdx) {
          boldParts.push(str.substring(lastIdx, boldMatch.index));
        }
        boldParts.push(
          <strong 
            key={`bold-${baseKey}-${boldMatch.index}`} 
            style={{ fontWeight: 'bold', color: '#FFE169' }}
          >
            {boldMatch[1]}
          </strong>
        );
        lastIdx = boldRegex.lastIndex;
      }

      if (lastIdx < str.length) {
        boldParts.push(str.substring(lastIdx));
      }
      return boldParts;
    };

    let keyCounter = 0;
    while ((match = linkRegex.exec(content)) !== null) {
      const matchIndex = match.index;
      if (matchIndex > lastIndex) {
        const textSegment = content.substring(lastIndex, matchIndex);
        parts.push(...parseBold(textSegment, keyCounter++));
      }
      const linkText = match[1];
      const linkUrl = match[2];
      parts.push(
        <a
          key={`link-${matchIndex}`}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: theme.color || '#E2B553',
            textDecoration: 'underline',
            fontWeight: 'bold',
            cursor: 'pointer',
            wordBreak: 'break-all'
          }}
        >
          {linkText}
        </a>
      );
      lastIndex = linkRegex.lastIndex;
    }

    if (lastIndex < content.length) {
      const textSegment = content.substring(lastIndex);
      parts.push(...parseBold(textSegment, keyCounter++));
    }

    return parts;
  };

  // 渲染单条对话气泡组件 (包含 inline 卡片展示)
  const renderMessage = (msg: typeof messages[0], index: number) => {
    const isUser = msg.role === 'user';
    const { text, deal, ticketDeal, weekendDeal, couponDeal } = parseMessageContent(msg.content);
    const isBooked = bookingSuccessMap[index];

    const isResponseToUser = !isUser && index > 0 && messages[index - 1]?.role === 'user';
    const isLatestAssistant = isResponseToUser && index === messages.length - 1;

    // 辅助渲染步骤面板，将其固定展示在回答（气泡）上方（取消头像并与气泡对齐）
    const renderSteps = () => {
      if (!isLatestAssistant) return null;
      return (
        <div key={`steps-${index}`} style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-start', padding: '0 4px', marginBottom: '20px', width: '100%' }}>
          <div style={{ marginLeft: '46px', width: '100%', maxWidth: '320px' }}>
            <LoadingStepsPanel theme={theme} isLoading={isLoading} />
          </div>
        </div>
      );
    };

    // 如果是助理回复，且内容为空，且没有卡片，暂不渲染气泡（但要渲染上方的推演过程面板）
    if (!isUser && !text.trim() && !deal && !ticketDeal && !weekendDeal && !couponDeal) {
      return renderSteps();
    }

    return (
      <React.Fragment key={index}>
        {renderSteps()}
        <div 
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
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '320px', gap: '10px' }}>
          
          {/* 文字内容 */}
          <div 
            className="pixel-panel"
            style={{ 
              width: '100%',
              boxSizing: 'border-box',
              padding: '12px 14px', 
              background: isUser ? 'rgba(226, 181, 83, 0.12)' : 'var(--bg-card)', 
              border: isUser ? '1px solid var(--primary)' : `1px solid var(--pixel-border-color)`,
              color: '#fff',
              fontSize: '0.8rem',
              lineHeight: '1.6',
              textAlign: 'left',
              borderRadius: '4px',
              whiteSpace: 'pre-wrap',
              boxShadow: isUser ? '0 0 10px rgba(226, 181, 83, 0.05)' : 'none',
              userSelect: 'text',
              WebkitUserSelect: 'text',
              cursor: 'text'
            }}
          >
            {/* 顶栏昵称 */}
            <div style={{ fontSize: '0.65rem', color: isUser ? '#FFE169' : theme.color, fontWeight: 'bold', marginBottom: '4px', userSelect: 'none', WebkitUserSelect: 'none' }}>
              {isUser ? `${currentUser?.username || '探索者'}` : '时空探路祭司'}
            </div>
            
            {renderTextWithLinks(text)}
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
                boxSizing: 'border-box',
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

          {/* 美团天命车票/机票卡片 TicketDeal */}
          {ticketDeal && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              id={`ticket-card-${index}`}
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '0px', 
                width: '100%', 
                boxSizing: 'border-box',
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
                <span className="font-mystic" style={{ fontSize: '0.85rem', fontWeight: 'bold', color: theme.color, textShadow: `0 0 8px ${theme.glow}`, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🎫 时空枢纽·{ticketDeal.type === 'train' ? '列车契约' : '飞行契约'}
                </span>
                <span style={{ fontSize: '0.55rem', position: 'absolute', top: '13px', right: '14px', color: '#ffb300', border: '1px solid #ffb300', padding: '1px 3px' }}>
                  {luckyElement}命特惠
                </span>
              </div>

              {/* 行程路线与时间 */}
              <div style={{ padding: '12px 14px 8px 14px', background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff' }}>{ticketDeal.from}</span>
                    <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>出发站</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, margin: '0 10px' }}>
                    <span style={{ fontSize: '0.55rem', color: theme.color, marginBottom: '2px' }}>{ticketDeal.date}</span>
                    <div style={{ width: '100%', height: '2px', background: 'rgba(255,255,255,0.15)', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: theme.color, position: 'absolute', left: 0 }} />
                      {ticketDeal.type === 'train' ? <Train size={12} style={{ color: theme.color, background: '#120d1c', padding: '0 2px', zIndex: 2 }} /> : <Plane size={12} style={{ color: theme.color, background: '#120d1c', padding: '0 2px', zIndex: 2 }} />}
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: theme.color, position: 'absolute', right: 0 }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff' }}>{ticketDeal.to}</span>
                    <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>到达站</span>
                  </div>
                </div>
              </div>

              {/* 方案列表 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px 14px', borderBottom: '1px dashed rgba(255,255,255,0.08)' }}>
                {ticketDeal.options && ticketDeal.options.map((opt: any, optIdx: number) => (
                  <div 
                    key={optIdx} 
                    style={{ 
                      padding: '10px', 
                      background: 'rgba(255,255,255,0.03)', 
                      border: '1px solid rgba(255,255,255,0.08)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      borderRadius: '0px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: theme.color }}>
                        {opt.number} ({opt.seatType})
                      </span>
                      <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#3CD070' }}>
                        {opt.price}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: '#eae3d9' }}>
                      <span>🕒 {opt.fromTime} → {opt.toTime} ({opt.duration})</span>
                    </div>

                    <p style={{ fontSize: '0.58rem', color: 'var(--text-muted)', margin: '0', textAlign: 'left', fontStyle: 'italic', lineHeight: '1.4' }}>
                      {opt.desc}
                    </p>

                    {/* 一键预订操作 */}
                    <div style={{ marginTop: '4px', display: 'flex', gap: '6px' }}>
                      <a
                        href={opt.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          flex: 1,
                          padding: '8px 10px',
                          background: `linear-gradient(45deg, ${theme.color}, ${theme.accent})`,
                          color: '#000',
                          fontWeight: 'bold',
                          fontSize: '0.68rem',
                          textAlign: 'center',
                          textDecoration: 'none',
                          boxShadow: '0 3px 0 rgba(0,0,0,0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        <span>🤝 契约预订 (美团直达)</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>

              {/* 底部票根撕扯装饰效果 */}
              <div style={{ display: 'flex', alignItems: 'center', width: '100%', height: '14px', overflow: 'hidden', position: 'relative' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#0d0b0a', borderRight: `2px solid ${theme.color}`, marginLeft: '-6px', zIndex: 10 }} />
                <div style={{ flex: 1, borderTop: '2px dashed rgba(255,255,255,0.15)', margin: '0 4px' }} />
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#0d0b0a', borderLeft: `2px solid ${theme.color}`, marginRight: '-6px', zIndex: 10 }} />
              </div>

              {/* 出征吉时推荐 */}
              <div style={{ 
                padding: '10px 14px 12px 14px', 
                fontSize: '0.6rem', 
                color: 'var(--text-muted)', 
                textAlign: 'left'
              }}>
                ℹ️ 乘此列车/航班出行，可于时空中契合幸运【{luckyElement}】气场，助推宿命吉运！
              </div>
            </motion.div>
          )}

          {/* 美团周末闲时规划卡片 WeekendDeal */}
          {weekendDeal && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              id={`ticket-card-${index}`}
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '0px', 
                width: '100%', 
                boxSizing: 'border-box',
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
              <div style={{ padding: '12px 14px 12px 14px', borderBottom: '1px dashed rgba(255,255,255,0.1)', position: 'relative' }}>
                <span className="font-mystic" style={{ fontSize: '0.95rem', fontWeight: 'bold', color: theme.color, textShadow: `0 0 8px ${theme.glow}`, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  📜 群体合盘·周末时光手札
                </span>
                <span style={{ fontSize: '0.55rem', position: 'absolute', top: '15px', right: '14px', color: '#ffb300', border: '1px solid #ffb300', padding: '1px 3px' }}>
                  天命推荐
                </span>
              </div>

              {/* 群像解盘 */}
              <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '0.65rem', color: '#eae3d9', lineHeight: '1.5', fontStyle: 'italic' }}>
                  " {weekendDeal.divinationSynthesis} "
                </div>
              </div>

              {/* 时间线 */}
              <div style={{ display: 'flex', flexDirection: 'column', padding: '14px 14px 4px 14px', position: 'relative' }}>
                <div style={{ position: 'absolute', left: '21px', top: '24px', bottom: '24px', width: '2px', background: `linear-gradient(180deg, ${theme.color} 0%, rgba(255,255,255,0.1) 100%)` }} />
                
                {weekendDeal.timeline && weekendDeal.timeline.map((node: any, idx: number) => (
                  <div key={idx} style={{ display: 'flex', gap: '12px', marginBottom: '16px', position: 'relative', zIndex: 2 }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#120d1c', border: `2px solid ${theme.color}`, display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0, marginTop: '2px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: theme.color }} />
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.6rem', color: theme.color, fontWeight: 'bold' }}>{node.time}</span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#fff' }}>{node.place}</span>
                        </div>
                        <span style={{ fontSize: '0.5rem', color: '#fff', background: theme.badgeBg, border: `1px solid ${theme.color}`, padding: '2px 4px', whiteSpace: 'nowrap' }}>
                          {node.tag}
                        </span>
                      </div>
                      
                      <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>
                        {renderTextWithLinks(node.mysticReasoning)}
                      </div>

                      {/* 餐饮特殊属性展示 */}
                      {node.restaurantStatus && (
                        <div style={{ marginTop: '6px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', padding: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ fontSize: '0.55rem', display: 'flex', gap: '6px' }}>
                            <span style={{ color: node.restaurantStatus?.queueStatus?.includes?.('空位') ? '#4caf50' : '#ff9800' }}>
                              {node.restaurantStatus.queueStatus}
                            </span>
                            <span style={{ color: 'var(--text-secondary)' }}>| {node.restaurantStatus.seatAvailability}</span>
                          </div>
                          <div style={{ fontSize: '0.55rem', color: '#75beff' }}>
                            {node.restaurantStatus.fitFor}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* 操作区 */}
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
                    >
                      <span>🤝 缔结天命契约 (一键安排)</span>
                    </button>
                    
                    {!sharedSuccessMap[index] ? (
                      <button
                        onClick={() => handleShareWeekendPlan(index)}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1.5px solid rgba(255, 255, 255, 0.12)',
                          color: '#eae3d9',
                          fontSize: '0.65rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          cursor: 'pointer'
                        }}
                      >
                        <Share2 size={12} />
                        <span>传送时空阵纹 (发给家属/朋友确认)</span>
                      </button>
                    ) : (
                      <div style={{ textAlign: 'center', fontSize: '0.6rem', color: '#4caf50', padding: '4px' }}>
                        ✅ 阵纹已送达，已收到结界成员意见反馈
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div
                      className="pixel-panel"
                      style={{
                        padding: '16px 12px',
                        background: 'rgba(21, 36, 21, 0.75)',
                        border: '2px solid #4caf50',
                        color: '#4caf50',
                        textAlign: 'center',
                        fontFamily: 'var(--font-mystic)'
                      }}
                    >
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem' }}>周末行程已锁定！</h4>
                      <p style={{ fontSize: '0.6rem', color: '#a5d6a7', margin: '0' }}>
                        已为您预约行程中的餐饮与游乐项目，预订短信已发送。
                      </p>
                    </div>

                    <button
                      onClick={() => handleShareWeekendPlan(index)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        background: 'rgba(76, 175, 80, 0.1)',
                        border: '1.5px solid rgba(76, 175, 80, 0.3)',
                        color: '#81c784',
                        fontSize: '0.65rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      <Share2 size={12} />
                      <span>🔗 传送阵纹给家属/好友 (已锁定版)</span>
                    </button>
                  </div>
                )}

                {/* 保存行程长图按钮 */}
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
                  <span>📸 保存行程手札至相册 (生成长图)</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* 领券专属福袋卡片 CouponDeal */}
          {couponDeal && <CouponWidget />}

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
      </React.Fragment>
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
          <button 
            onClick={() => navigate('/')} 
            style={{ 
              background: 'none', border: 'none', color: theme.color, 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              cursor: 'pointer', padding: 0, marginRight: '4px'
            }}
          >
            <ChevronLeft size={24} />
          </button>
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
          
          {/* 美团导购助手激活状态按钮 */}
          <button
            onClick={() => {
              if (venueBindStatus?.valid) {
                setVenueWidgetStep(3);
              } else {
                setVenueWidgetStep(0);
              }
              setShowVenueWidget(true);
            }}
            style={{
              background: venueBindStatus?.valid ? 'rgba(212, 163, 89, 0.15)' : 'rgba(255,255,255,0.06)',
              border: venueBindStatus?.valid ? '1px solid #D4A359' : '1px solid rgba(255,255,255,0.1)',
              padding: '4px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: venueBindStatus?.valid ? '#D4A359' : 'var(--text-secondary)',
              fontSize: '0.65rem',
              cursor: 'pointer',
              borderRadius: '0px',
              fontWeight: venueBindStatus?.valid ? 'bold' : 'normal'
            }}
            title={venueBindStatus?.valid ? '已绑定美团导购，点击管理' : '激活美团导购助手'}
          >
            <Sparkles size={12} style={{ color: venueBindStatus?.valid ? '#D4A359' : 'inherit' }} />
            <span>{venueBindStatus?.valid ? '美团已激活' : '美团导购'}</span>
          </button>

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
            padding: '80px 0 30px 0',
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
                width: '190px',
                height: '190px',
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
                  width: '150px',
                  height: '150px',
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
                  fontSize: '0.55rem',
                  fontFamily: 'var(--font-mystic)',
                  color: 'var(--text-muted)',
                  opacity: 0.5
                }}>
                  <span style={{ position: 'absolute', top: '6px', left: '50%', transform: 'translateX(-50%)' }}>子</span>
                  <span style={{ position: 'absolute', bottom: '6px', left: '50%', transform: 'translateX(-50%)' }}>午</span>
                  <span style={{ position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)' }}>卯</span>
                  <span style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)' }}>酉</span>
                </div>

                {/* 磁针 */}
                <div style={{
                  position: 'absolute',
                  width: '8px',
                  height: '105px',
                  transform: `rotate(${currentDir.angle}deg)`,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{
                    width: 0, height: 0,
                    borderLeft: '4.5px solid transparent',
                    borderRight: '4.5px solid transparent',
                    borderBottom: `15px solid ${theme.color}`,
                    filter: `drop-shadow(0 0 4px ${theme.color})`
                  }} />
                  <div style={{
                    width: '5px', height: '5px',
                    borderRadius: '50%', background: '#fff',
                    border: '1px solid var(--pixel-border-color)',
                    position: 'absolute', top: '50%', transform: 'translateY(-50%)'
                  }} />
                  <div style={{
                    width: 0, height: 0,
                    borderLeft: '4.5px solid transparent',
                    borderRight: '4.5px solid transparent',
                    borderTop: '12px solid rgba(255,255,255,0.1)'
                  }} />
                </div>

                {/* 居中五行字眼 */}
                <div className="font-mystic" style={{ fontSize: '1.2rem', color: theme.color, fontWeight: 'bold', textShadow: `${theme.color} 0 0 10px`, zIndex: 5 }}>
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

        {/* 动态输入加载指示器已被移至 renderMessage 气泡内部上方展示 */}

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
              marginBottom: '0px', // No nav bar anymore
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

      {/* 美团生活服务导购助手 Widget 弹窗组件 */}
      <AnimatePresence>
        {showVenueWidget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0, 0, 0, 0.8)',
              backdropFilter: 'blur(8px)',
              zIndex: 999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              style={{
                width: '90%',
                maxWidth: '420px',
                background: 'rgba(22, 18, 28, 0.95)',
                border: '1px solid rgba(212, 163, 89, 0.3)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.6), inset 0 0 12px rgba(212, 163, 89, 0.05)',
                padding: '24px',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}
            >
              {/* 弹窗头部 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="font-mystic" style={{ color: '#D4A359', margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={18} />
                  <span>美团生活服务导购</span>
                </h3>
                <button
                  onClick={() => setShowVenueWidget(false)}
                  style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.2rem', padding: 0 }}
                >
                  ✕
                </button>
              </div>

              {/* 错误提示 */}
              {venueError && (
                <div style={{
                  padding: '10px 12px',
                  background: 'rgba(255, 74, 74, 0.1)',
                  border: '1px solid rgba(255, 74, 74, 0.3)',
                  color: '#ff8888',
                  fontSize: '0.75rem',
                  lineHeight: '1.4'
                }}>
                  ⚠️ {venueError}
                </div>
              )}

              {/* 步骤内容机 */}
              {venueLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 0', gap: '12px' }}>
                  <RefreshCw size={32} className="spinner-icon" style={{ animation: 'spin 1.5s linear infinite', color: '#D4A359' }} />
                  <span style={{ fontSize: '0.75rem', color: '#aaa' }}>正在与时空枢纽通讯中...</span>
                </div>
              ) : (
                <>
                  {/* Step 0: 免责与服务声明 */}
                  {venueWidgetStep === 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div style={{ 
                        fontSize: '0.8rem', 
                        color: '#bbb', 
                        background: 'rgba(0,0,0,0.3)', 
                        padding: '12px', 
                        lineHeight: '1.5',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}>
                        <p style={{ margin: 0 }}>📋 本服务由美团提供，覆盖外卖、闪购、餐饮团购、丽人运动休闲、医药五大业务线导购推荐。</p>
                        <p style={{ margin: 0 }}>🔐 您的登录凭证仅保存在本地设备，不会上传至任何第三方。</p>
                        <p style={{ margin: 0 }}>📌 推送的会场链接与您绑定的媒体口令关联，口令仅限本人使用，不得转让或分享。</p>
                        <p style={{ margin: 0 }}>⚠️ 请在安全的 AI 平台中使用本服务，美团对第三方 AI 平台的行为不承担责任。</p>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: '#888', margin: 0 }}>同意即表示您已阅读并接受上述规则，可以开始使用服务。</p>
                      <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                        <button
                          onClick={() => setShowVenueWidget(false)}
                          style={{ flex: 1, padding: '10px', background: '#25212b', border: '1px solid #444', color: '#aaa', cursor: 'pointer' }}
                        >
                          拒绝
                        </button>
                        <button
                          onClick={handleStartAuth}
                          style={{ flex: 1, padding: '10px', background: 'linear-gradient(45deg, #D4A359, #F5D38A)', border: 'none', color: '#000', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                          同意并继续
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 1: 展示二维码扫码 */}
                  {venueWidgetStep === 1 && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
                      <span style={{ fontSize: '0.8rem', color: '#ccc', textAlign: 'center' }}>
                        📱 请使用美团 App 扫描下方二维码授权，或点击链接授权
                      </span>
                      {venueQrCodeUrl && (
                        <div style={{ padding: '8px', background: '#fff', border: '4px solid #D4A359' }}>
                          <img src={venueQrCodeUrl} alt="Meituan Auth QR" style={{ width: '180px', height: '180px', display: 'block' }} />
                        </div>
                      )}
                      {venueAuthUrl && (
                        <a
                          href={venueAuthUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#D4A359', textDecoration: 'underline', fontSize: '0.8rem', fontWeight: 'bold' }}
                        >
                          👉 [网页点击授权通道]
                        </a>
                      )}
                      <span style={{ fontSize: '0.7rem', color: '#888', textAlign: 'center', lineHeight: '1.4' }}>
                        ⏱ 链接有效期 10 分钟。<br />授权完成后，系统将自动检测并跳转。
                      </span>
                    </div>
                  )}



                  {/* Step 3: 管理/已绑定展示 */}
                  {venueWidgetStep === 3 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#D4A359' }}>
                        <CheckCircle size={24} />
                        <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>美团智能导购服务已激活</span>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: '#aaa', margin: 0, textAlign: 'center' }}>
                        已解锁以下五大业务优惠推荐权限：
                      </p>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.75rem' }}>
                        {venueLinks.length > 0 ? (
                          venueLinks.map((link, idx) => (
                            <div key={idx} style={{
                              padding: '6px 8px',
                              background: 'rgba(212, 163, 89, 0.08)',
                              border: '1px solid rgba(212, 163, 89, 0.2)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              color: '#eee'
                            }}>
                              <span>🎁</span>
                              <span>{link.tenantName || '优惠会场'}</span>
                            </div>
                          ))
                        ) : (
                          <div style={{ gridColumn: 'span 2', textAlign: 'center', color: '#888', padding: '10px 0' }}>
                            暂无加载的专属链接
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                        <button
                          onClick={handleVenueLogout}
                          style={{ flex: 1, padding: '10px', background: 'rgba(255, 74, 74, 0.1)', border: '1px solid #ff4a4a', color: '#ff4a4a', cursor: 'pointer' }}
                        >
                          退出登录
                        </button>
                        <button
                          onClick={() => setShowVenueWidget(false)}
                          style={{ flex: 1, padding: '10px', background: '#333', border: '1px solid #555', color: '#fff', cursor: 'pointer' }}
                        >
                          关闭
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
