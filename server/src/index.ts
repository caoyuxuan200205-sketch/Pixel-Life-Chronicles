import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ==========================================
// AI 逻辑迁移至后端 (保护 API Key)
// ==========================================
const DOUBAO_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

const buildSystemPrompt = (method: string) => {
  const isBazi = method === 'bazi';
  return `你是"像素生活志"APP中的一位顶级神秘学大师。你不仅精通${isBazi ? '四柱八字命理' : '西方神秘塔罗'}，还是一位洞察力极强的城市空间策展人。
你的任务：
1. ${isBazi ? '根据用户的出生信息进行排盘。' : '根据用户当前的时间和情绪状态，从塔罗牌中选出一张牌。'}
2. 从提供的商户列表中，锁定那家最适合用户的店面。
3. 撰写一段具有宿命感和文学美感的占卜判词（60-80字）。

必须严格返回 JSON 格式：
{
  "cardName": "名称",
  "emoji": "对应emoji",
  "meaning": "寓意短语",
  "poiId": "商户id",
  "reading": "判词内容"
}`;
};

app.post('/api/ai/reading', async (req, res) => {
  try {
    const { mood, pois, method, baziInfo, timeContext } = req.body;
    const apiKey = process.env.DOUBAO_API_KEY;
    const modelId = process.env.DOUBAO_MODEL_ID;

    if (!apiKey || !modelId) {
      return res.status(500).json({ error: 'Backend AI not configured' });
    }

    const response = await axios.post(
      DOUBAO_ENDPOINT,
      {
        model: modelId,
        messages: [
          { role: 'system', content: buildSystemPrompt(method) },
          { 
            role: 'user', 
            content: `【当前环境】${timeContext}
【用户倾向】${JSON.stringify(mood)}
【占卜方式】${method}
${baziInfo ? `【八字信息】${JSON.stringify(baziInfo)}` : ''}
【候选商户】：${JSON.stringify(pois.slice(0, 10))}
请返回 JSON 占卜结果。` 
          },
        ],
        temperature: 0.8,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
      }
    );

    let content = response.data.choices?.[0]?.message?.content;
    if (content) {
      // 提取 JSON
      const jsonMatch = content.match(/({[\s\S]*})/);
      if (jsonMatch) content = jsonMatch[1];
      res.json(JSON.parse(content));
    } else {
      throw new Error('Empty AI response');
    }
  } catch (error: any) {
    console.error('AI Proxy Error:', error.message);
    res.status(500).json({ error: 'AI processing failed' });
  }
});

// 基础路由
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Pixel Life Chronicles Backend is running' });
});

app.listen(PORT, () => {
  console.log(`
  👾 Pixel Life Chronicles Backend
  🚀 Server running on http://localhost:${PORT}
  `);
});
