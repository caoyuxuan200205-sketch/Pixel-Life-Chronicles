import axios from "axios";
import { execFile } from "child_process";
import { promisify } from "util";
import os from "os";
import path from "path";
import fs from "fs";

const execFileAsync = promisify(execFile);

function getAIConfig() {
  const qwenApiKey = process.env.QWEN_API_KEY;
  if (qwenApiKey && qwenApiKey !== 'YOUR_QWEN_API_KEY_HERE' && qwenApiKey.trim() !== '') {
    return {
      apiKey: qwenApiKey.trim(),
      baseUrl: (process.env.QWEN_BASE_URL || 'https://api-inference.modelscope.cn/v1').trim(),
      modelId: (process.env.QWEN_MODEL || 'Qwen/Qwen3.5-35B-A3B').trim(),
    };
  }

  // Fallback to Doubao
  return {
    apiKey: (process.env.DOUBAO_API_KEY || process.env.VITE_DOUBAO_API_KEY || '').trim(),
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    modelId: (process.env.DOUBAO_MODEL_ID || process.env.VITE_DOUBAO_MODEL_ID || '').trim(),
  };
}

export async function extractTicketIntent(userText: string, defaultCity: string) {
  const { apiKey, baseUrl, modelId } = getAIConfig();
  if (!apiKey) return { isTicketQuery: false, city: defaultCity, query: '' };

  try {
    const response = await axios.post(`${baseUrl}/chat/completions`, {
      model: modelId,
      messages: [
        {
          role: 'system',
          content: `你是一个出行业务意图识别助手。请分析用户的输入，判断用户是否在查询或订购【火车票】或【机票】。
如果是，请从输入中提取出查询对应的城市（出发城市）和完整的查询需求。

你必须严格返回以下 JSON 格式，不要包含任何 markdown 标记：
{
  "isTicketQuery": true,
  "city": "出发城市（如南京、北京，若没有则默认为当前城市）",
  "query": "精简的查询句子，例如'明天南京到上海的火车票'或'6月3日北京到广州的机票'"
}
如果用户不是在查询火车票或机票，请直接返回：
{
  "isTicketQuery": false,
  "city": "",
  "query": ""
}`
        },
        {
          role: 'user',
          content: `用户输入："${userText}"，默认当前城市："${defaultCity}"`
        }
      ],
      temperature: 0.1,
      response_format: { type: "json_object" }
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 6000
    });

    const content = response.data?.choices?.[0]?.message?.content || '';
    console.log('Ticket intent extraction result from LLM in LangGraph:', content);
    let cleaned = content.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    const parsed = JSON.parse(cleaned);
    return {
      isTicketQuery: !!parsed.isTicketQuery,
      city: (parsed.city || defaultCity).trim(),
      query: (parsed.query || userText).trim()
    };
  } catch (error) {
    console.error('Failed to extract ticket intent in LangGraph:', error);
    // Fallback to regex
    const hasTicketKw = /票|车|机|航班|高铁|火车|飞|出行/.test(userText);
    if (hasTicketKw) {
      return { isTicketQuery: true, city: defaultCity, query: userText };
    }
    return { isTicketQuery: false, city: defaultCity, query: '' };
  }
}

export async function queryMeituanTravelCLI(city: string, query: string) {
  const mtToken = process.env.MEITUAN_TRAVEL_TOKEN;
  if (!mtToken) {
    throw new Error('服务端未配置 MEITUAN_TRAVEL_TOKEN 环境变量，无法查询车票');
  }

  // 动态注入 config.json 以兼容部署环境
  const mtConfigDir = path.join(os.homedir(), '.config', 'meituan-travel');
  if (!fs.existsSync(mtConfigDir)) {
    fs.mkdirSync(mtConfigDir, { recursive: true });
  }
  fs.writeFileSync(path.join(mtConfigDir, 'config.json'), JSON.stringify({ key: mtToken }), 'utf-8');

  console.log(`Executing Meituan CLI (LangGraph): mttravel "${city}" "${query}"`);
  const { stdout, stderr } = await execFileAsync('npx', [
    '-p', '@meituan-travel/travel-cli', 'mttravel',
    city.trim(), query.trim()
  ], {
    timeout: 45000,
    maxBuffer: 1024 * 1024 * 5,
    windowsHide: true,
    shell: process.platform === 'win32'
  });
  return [stdout, stderr].map(String).filter(Boolean).join('\n');
}
