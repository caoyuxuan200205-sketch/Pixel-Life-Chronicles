// ============================================
// 豆包 (Doubao / Volcengine Ark) AI 服务
// ============================================

import {
  TAROT_CARDS,
  POI_DATABASE,
  generateReading as generateLocalReading,
  type TarotCard,
  type POIData,
} from '../store';

// ==========================================
// 情绪标签定义
// ==========================================
export interface MoodTag {
  id: string;
  emoji: string;
  label: string;
  description: string;
}

export const MOOD_TAGS: MoodTag[] = [
  { id: 'tired',    emoji: '🔋', label: '电量告急',     description: '用户感到疲惫、精力耗尽，需要安静、治愈、充电的场所' },
  { id: 'bored',    emoji: '🌪️', label: '无聊到爆',     description: '用户感到极度无聊，渴望新鲜、刺激、有趣的体验' },
  { id: 'wander',   emoji: '🚶', label: '想随便走走',   description: '用户没有明确目的，只想漫无目的地闲逛、散步、发呆' },
  { id: 'hungry',   emoji: '🍜', label: '需要碳水',     description: '用户饿了或嘴馋，想吃好吃的，需要美食推荐' },
  { id: 'social',   emoji: '🍻', label: '想找人聊聊',   description: '用户想社交、聚会、和朋友或陌生人产生连接' },
  { id: 'creative', emoji: '🎨', label: '灵感枯竭',     description: '用户需要创意灵感，想去有艺术氛围、能激发创造力的地方' },
];

export interface BaziInfo {
  name: string;
  gender: 'male' | 'female';
  birthDate: string; // YYYY-MM-DD
  birthTime: string; // HH:mm
  birthPlace?: string;
}

// ==========================================
// AI 返回结果类型
// ==========================================
export interface AIReadingResult {
  cardName: string;
  emoji: string;
  meaning: string;
  poiId: string;
  reading: string;
}

// ==========================================
// 豆包 API 配置
// ==========================================
const DOUBAO_CONFIG = {
  endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
  apiKey: 'ark-68e0d61c-2646-4a0e-8ac1-7ea35da99d21-a6c8f',       
  modelId: 'ep-20260423222610-xbx2l',      
  timeout: 60000,
};

export function configureDoubao(apiKey: string, modelId: string) {
  DOUBAO_CONFIG.apiKey = apiKey;
  DOUBAO_CONFIG.modelId = modelId;
  localStorage.setItem('plc_doubao_api_key', apiKey);
  localStorage.setItem('plc_doubao_model_id', modelId);
}

export function loadDoubaoConfig(): boolean {
  const apiKey = localStorage.getItem('plc_doubao_api_key');
  const modelId = localStorage.getItem('plc_doubao_model_id');
  if (apiKey && modelId) {
    DOUBAO_CONFIG.apiKey = apiKey;
    DOUBAO_CONFIG.modelId = modelId;
    return true;
  }
  return false;
}

export function isAIConfigured(): boolean {
  return !!(DOUBAO_CONFIG.apiKey && DOUBAO_CONFIG.modelId);
}

function getTimeContext(): string {
  const now = new Date();
  const hour = now.getHours();
  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const dayName = dayNames[now.getDay()];
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;

  let timeSlot = '';
  if (hour >= 6 && hour < 9) timeSlot = '清晨';
  else if (hour >= 9 && hour < 12) timeSlot = '上午';
  else if (hour >= 12 && hour < 14) timeSlot = '中午';
  else if (hour >= 14 && hour < 17) timeSlot = '下午';
  else if (hour >= 17 && hour < 19) timeSlot = '傍晚';
  else if (hour >= 19 && hour < 22) timeSlot = '晚上';
  else timeSlot = '深夜';

  return `现在是${dayName}${timeSlot} ${hour}:${String(now.getMinutes()).padStart(2, '0')}，${isWeekend ? '周末时光' : '工作日'}`;
}

// ==========================================
// 构建 System Prompt (融入 bazi-skill 逻辑)
// ==========================================
function buildSystemPrompt(method: string = 'tarot'): string {
  const isBazi = method === 'bazi';
  
  let basePrompt = `你是"像素生活志"APP中的一位顶级神秘学大师。你不仅精通${isBazi ? '四柱八字命理（通晓《三命通会》、《穷通宝鉴》）' : '西方神秘塔罗（通晓金龙黎明会体系）'}，还是一位极具洞察力的城市空间策展人。

你的任务：
1. ${isBazi ? '根据用户的【出生信息】进行深度排盘。分析日主（日元）的强弱、五行的盈亏、以及命局中的"格"与"局"（如：食神吐秀格、建禄格等）。' : '根据用户当前的【时间】和【情绪状态】，从提供的塔罗牌列表中选出最具灵魂共鸣的一张牌。'}
2. 从提供的真实商户列表(JSON)中，锁定那家能够作为用户"能量补给站"的唯一店面。
3. 撰写一段具有**绝对说服力**和**宿命感**的占卜判词。

判词结构要求（必须融合，不要生硬拆分）：
- 【宿命点破】：${isBazi ? '一针见血地指出用户命局当前的能量失衡点（如：金多水浊、火旺木焚）。' : '揭示当下宇宙能量对用户的心理映射。'}
- 【时空共振】：解释为什么这家店（及其地理属性）是破解当前能量僵局的"钥匙"。
- 【改运指引】：用极具文学美感的语言，指引用户如何在此处与时空能量达成和解。

语气要求：${isBazi ? '权威、犀利、透彻。像一位看透天机的老友在为你点拨迷津。大量使用专业的命理术语（如：劫财夺财、伤官见官、化气格、喜用神），但要表达得如诗如画。' : '神秘、克制、温暖。使用命运、星象、结界等意象。'}`;

  if (isBazi) {
    basePrompt += `
【八字深度逻辑】：
- 必须基于用户的出生时间推算出日主。
- 推荐逻辑必须严密：如果用户命局燥烈，必须推荐具有"壬癸水"意象的场所（如河畔、蓝调咖啡馆、安静角落）；如果用户命局阴寒，则推荐具有"丙丁火"意象的场所（如暖光灯、阳光房、热闹集市）。
- 严禁空洞的祝福，必须有逻辑支撑。`;
  }

  basePrompt += `

你必须严格按照以下 JSON 格式返回，不要输出任何其他内容：
{
  "cardName": "${isBazi ? '八字格局名称' : '塔罗牌名称'}",
  "emoji": "对应emoji",
  "meaning": "4-8字的寓意短语",
  "poiId": "商户的id字段",
  "reading": "60-80字的占卜判词"
}
`;
  return basePrompt;
}

// ==========================================
// 构建 User Prompt
// ==========================================
function buildUserPrompt(mood: MoodTag | null, pois: POIData[], method: string, baziInfo?: BaziInfo): string {
  const timeContext = getTimeContext();
  const moodDesc = mood ? `${mood.emoji} ${mood.label} — ${mood.description}` : '用户未选择明确情绪，听凭天命。';

  let userContent = `【当前环境】${timeContext}
【用户倾向】${moodDesc}
【占卜方式】${method === 'bazi' ? '东方八字' : '西方塔罗'}
`;

  if (method === 'bazi' && baziInfo) {
    userContent += `【用户出生信息】姓名：${baziInfo.name}，性别：${baziInfo.gender === 'male' ? '男' : '女'}，出生：${baziInfo.birthDate} ${baziInfo.birthTime}\n`;
  }

  const poisJson = JSON.stringify(
    pois.slice(0, 15).map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      rating: p.rating,
      address: p.address || '',
    })),
    null,
    2
  );

  userContent += `
【候选商户】：
${poisJson}

请进行占卜解析并仅返回 JSON。`;
  return userContent;
}

// ==========================================
// 调用豆包 API
// ==========================================
async function callDoubaoAPI(mood: MoodTag | null, pois: POIData[], method: string, baziInfo?: BaziInfo): Promise<AIReadingResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DOUBAO_CONFIG.timeout);

  try {
    const response = await fetch(DOUBAO_CONFIG.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DOUBAO_CONFIG.apiKey}`,
      },
      body: JSON.stringify({
        model: DOUBAO_CONFIG.modelId,
        messages: [
          { role: 'system', content: buildSystemPrompt(method) },
          { role: 'user', content: buildUserPrompt(mood, pois, method, baziInfo) },
        ],
        temperature: 0.8,
        max_tokens: 500,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API 返回 ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) throw new Error('AI 返回内容为空');

    let jsonStr = content.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();

    return JSON.parse(jsonStr);
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// ==========================================
// 本地兜底生成
// ==========================================
function generateLocalFallback(mood: MoodTag | null, pois: POIData[]): AIReadingResult {
  const validPois = (pois && pois.length > 0) ? pois : POI_DATABASE;
  const moodId = mood?.id || 'wander';
  
  const moodPoiMap: Record<string, string[]> = {
    tired:    ['咖啡', '公园', '风景'],
    bored:    ['体验', '娱乐', '展览'],
    wander:   ['公园', '书店', '风景'],
    hungry:   ['餐饮', '美食', '咖啡'],
    social:   ['清吧', '咖啡', '娱乐'],
    creative: ['书店', '展览', '艺术'],
  };

  const preferredKeywords = moodPoiMap[moodId] || [];
  let poi = validPois.find((p) => preferredKeywords.some(kw => p.type.includes(kw) || p.name.includes(kw)));
  if (!poi) poi = validPois[Math.floor(Math.random() * validPois.length)];

  const moodCardMap: Record<string, number> = {
    tired: 7, bored: 0, wander: 4, hungry: 5, social: 6, creative: 1,
  };

  const cardIndex = moodCardMap[moodId] ?? Math.floor(Math.random() * TAROT_CARDS.length);
  const card = TAROT_CARDS[cardIndex];

  return {
    cardName: card.name,
    emoji: card.emoji,
    meaning: card.meaning,
    poiId: poi.id,
    reading: generateLocalReading(poi, card),
  };
}

// ==========================================
// 主入口：AI 抽卡 (更新支持方法与八字)
// ==========================================
export async function performAIReading(
  mood: MoodTag | null,
  pois: POIData[],
  onStatusChange?: (status: string) => void,
  method: string = 'tarot',
  baziInfo?: BaziInfo
): Promise<{
  aiResult: AIReadingResult;
  card: TarotCard;
  poi: POIData;
  isAI: boolean;
}> {
  let aiResult: AIReadingResult;
  let isAI = false;
  const validPois = (pois && pois.length > 0) ? pois : POI_DATABASE;

  if (isAIConfigured()) {
    try {
      onStatusChange?.('正在感应命运轨迹…');
      await delay(1200);
      onStatusChange?.(method === 'bazi' ? '正在排布乾坤八字…' : '星空之门正在开启…');
      
      aiResult = await callDoubaoAPI(mood, validPois, method, baziInfo);
      isAI = true;
      onStatusChange?.('命运已揭晓');
    } catch (err) {
      console.warn('AI 失败:', err);
      onStatusChange?.('信号微弱，启用本地占卜…');
      await delay(500);
      aiResult = generateLocalFallback(mood, validPois);
    }
  } else {
    onStatusChange?.('解析中…');
    await delay(1000);
    aiResult = generateLocalFallback(mood, validPois);
  }

  const card = TAROT_CARDS.find((c) => c.name === aiResult.cardName)
    || TAROT_CARDS.find((c) => c.emoji === aiResult.emoji)
    || TAROT_CARDS[0];

  const poi = validPois.find((p) => p.id === aiResult.poiId)
    || validPois[Math.floor(Math.random() * validPois.length)];

  return {
    aiResult,
    card: { ...card, name: aiResult.cardName || card.name, emoji: aiResult.emoji || card.emoji },
    poi,
    isAI,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
