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
  description: string; // 给 AI 的上下文描述
}

export const MOOD_TAGS: MoodTag[] = [
  { id: 'tired',    emoji: '🔋', label: '电量告急',     description: '用户感到疲惫、精力耗尽，需要安静、治愈、充电的场所' },
  { id: 'bored',    emoji: '🌪️', label: '无聊到爆',     description: '用户感到极度无聊，渴望新鲜、刺激、有趣的体验' },
  { id: 'wander',   emoji: '🚶', label: '想随便走走',   description: '用户没有明确目的，只想漫无目的地闲逛、散步、发呆' },
  { id: 'hungry',   emoji: '🍜', label: '需要碳水',     description: '用户饿了或嘴馋，想吃好吃的，需要美食推荐' },
  { id: 'social',   emoji: '🍻', label: '想找人聊聊',   description: '用户想社交、聚会、和朋友或陌生人产生连接' },
  { id: 'creative', emoji: '🎨', label: '灵感枯竭',     description: '用户需要创意灵感，想去有艺术氛围、能激发创造力的地方' },
];

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
  // 火山引擎 Ark API 端点
  endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
  // 用户真实的 API Key 和模型 Endpoint ID
  apiKey: 'ark-68e0d61c-2646-4a0e-8ac1-7ea35da99d21-a6c8f',       
  modelId: 'ep-20260423222610-xbx2l',      
  timeout: 60000,    // 推理大模型思考时间长，放宽到 60s
};

/**
 * 配置豆包 API 凭证
 */
export function configureDoubao(apiKey: string, modelId: string) {
  DOUBAO_CONFIG.apiKey = apiKey;
  DOUBAO_CONFIG.modelId = modelId;
  // 持久化到 localStorage
  localStorage.setItem('plc_doubao_api_key', apiKey);
  localStorage.setItem('plc_doubao_model_id', modelId);
}

/**
 * 从 localStorage 恢复配置
 */
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

/**
 * 检查是否已配置 API
 */
export function isAIConfigured(): boolean {
  return !!(DOUBAO_CONFIG.apiKey && DOUBAO_CONFIG.modelId);
}

// ==========================================
// 获取当前环境上下文
// ==========================================
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
// 构建 System Prompt
// ==========================================
function buildSystemPrompt(): string {
  return `你是"像素生活志"APP中的一位神秘占卜师。你精通塔罗牌占卜，同时对城市中的隐藏好去处了如指掌。

你的任务：
1. 根据用户当前的【时间】和【情绪状态】，从提供的塔罗牌列表中选出最贴切的一张牌。
2. 从提供的真实商户列表(JSON)中，挑选最能治愈/匹配用户当前状态的一家店。
3. 写一段60-80字的占卜判词，将塔罗牌的寓意与这家店的氛围巧妙融合。

语气要求：神秘、克制、温暖，像一个真正懂你的占卜师在低语。不要用"推荐"、"建议"这类直白的词，要用命运、星象、结界等意象来包装。

你必须严格按照以下 JSON 格式返回，不要输出任何其他内容：
{
  "cardName": "塔罗牌名称",
  "emoji": "对应emoji",
  "meaning": "4-8字的牌面寓意短语",
  "poiId": "商户的id字段",
  "reading": "60-80字的占卜判词"
}`;
}

// ==========================================
// 构建 User Prompt
// ==========================================
function buildUserPrompt(mood: MoodTag, pois: POIData[]): string {
  const timeContext = getTimeContext();

  const cardsJson = JSON.stringify(
    TAROT_CARDS.map((c) => ({ name: c.name, emoji: c.emoji, meaning: c.meaning })),
    null,
    2
  );

  const poisJson = JSON.stringify(
    pois.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      rating: p.rating,
      distance: `${(p.distance / 1000).toFixed(1)}km`,
      address: p.address || '',
    })),
    null,
    2
  );

  return `【环境】${timeContext}
【用户情绪】${mood.emoji} ${mood.label} — ${mood.description}

可选塔罗牌：
${cardsJson}

可选真实商户：
${poisJson}

请根据以上信息，选择最合适的牌和商户，生成占卜结果。仅返回JSON。`;
}

// ==========================================
// 调用豆包 API
// ==========================================
async function callDoubaoAPI(mood: MoodTag, pois: POIData[]): Promise<AIReadingResult> {
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
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: buildUserPrompt(mood, pois) },
        ],
        temperature: 0.85,
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

    if (!content) {
      throw new Error('AI 返回内容为空');
    }

    // 从返回内容中提取 JSON（兼容 markdown code block 包裹的情况）
    let jsonStr = content.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const result: AIReadingResult = JSON.parse(jsonStr);

    // 校验必要字段
    if (!result.cardName || !result.poiId || !result.reading) {
      throw new Error('AI 返回的 JSON 缺少必要字段');
    }

    return result;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// ==========================================
// 本地兜底生成（当 AI 不可用时）
// ==========================================
function generateLocalFallback(mood: MoodTag, pois: POIData[]): AIReadingResult {
  if (!pois || pois.length === 0) pois = POI_DATABASE; // 保底

  // 根据情绪做简单的启发式匹配
  const moodPoiMap: Record<string, string[]> = {
    tired:    ['咖啡', '公园', '风景'],
    bored:    ['体验', '娱乐', '展览'],
    wander:   ['公园', '书店', '风景'],
    hungry:   ['餐饮', '美食', '咖啡'],
    social:   ['清吧', '咖啡', '娱乐'],
    creative: ['书店', '展览', '艺术'],
  };

  const preferredKeywords = moodPoiMap[mood.id] || [];
  let poi = pois.find((p) => preferredKeywords.some(kw => p.type.includes(kw) || p.name.includes(kw)));
  if (!poi) {
    poi = pois[Math.floor(Math.random() * pois.length)];
  }

  // 根据情绪选一张"感觉对的"牌
  const moodCardMap: Record<string, number> = {
    tired: 7,     // 隐者
    bored: 0,     // 愚者
    wander: 4,    // 月亮
    hungry: 5,    // 太阳
    social: 6,    // 命运之轮
    creative: 1,  // 魔法师
  };

  const cardIndex = moodCardMap[mood.id] ?? Math.floor(Math.random() * TAROT_CARDS.length);
  const card = TAROT_CARDS[cardIndex];

  const reading = generateLocalReading(poi, card);

  return {
    cardName: card.name,
    emoji: card.emoji,
    meaning: card.meaning,
    poiId: poi.id,
    reading,
  };
}

// ==========================================
// 主入口：AI 抽卡（带自动降级）
// ==========================================
export async function performAIReading(
  mood: MoodTag,
  pois: POIData[],
  onStatusChange?: (status: string) => void
): Promise<{
  aiResult: AIReadingResult;
  card: TarotCard;
  poi: POIData;
  isAI: boolean;
}> {
  let aiResult: AIReadingResult;
  let isAI = false;
  
  // 如果调用方没有传 POI，使用本地兜底库
  const validPois = (pois && pois.length > 0) ? pois : POI_DATABASE;

  if (isAIConfigured()) {
    try {
      onStatusChange?.('正在感应当前星象…');
      await delay(1500);
      onStatusChange?.('星空之门正在开启 (AI 思考中)…');
      
      aiResult = await callDoubaoAPI(mood, validPois);
      isAI = true;

      onStatusChange?.('命运已揭晓');
    } catch (err) {
      console.warn('AI 调用失败，降级到本地生成:', err);
      onStatusChange?.('星象信号微弱，启用本地占卜…');
      await delay(500);
      aiResult = generateLocalFallback(mood, validPois);
    }
  } else {
    onStatusChange?.('星象解析中…');
    await delay(1200);
    aiResult = generateLocalFallback(mood, validPois);
  }

  // 匹配完整的 Card 和 POI 对象
  const card = TAROT_CARDS.find((c) => c.name === aiResult.cardName)
    || TAROT_CARDS.find((c) => c.emoji === aiResult.emoji)
    || TAROT_CARDS[Math.floor(Math.random() * TAROT_CARDS.length)];

  const poi = validPois.find((p) => p.id === aiResult.poiId)
    || validPois[Math.floor(Math.random() * validPois.length)];

  // 如果 AI 返回了自定义的 meaning，覆盖到 card 上
  if (aiResult.meaning && aiResult.meaning !== card.meaning) {
    card.meaning = aiResult.meaning;
  }

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
