import axios from "axios";
import { execFile } from "child_process";
import { promisify } from "util";
import { createRequire } from "module";
import os from "os";
import path from "path";
import fs from "fs";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

export type TicketSupplyStatus = "available" | "sold_out" | "summary_only";
export type TravelSupplyKind = "ticket" | "hotel";

export interface TicketSupplyResult {
  status: TicketSupplyStatus;
  content: string;
  traceId?: string;
}

export class TicketToolError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_CONFIGURED" | "AUTH_FAILED" | "TIMEOUT" | "CLI_UNAVAILABLE" | "UPSTREAM_ERROR"
  ) {
    super(message);
    this.name = "TicketToolError";
  }
}

function getAIConfig() {
  const qwenApiKey = process.env.QWEN_API_KEY;
  if (qwenApiKey && qwenApiKey !== 'YOUR_QWEN_API_KEY_HERE' && qwenApiKey.trim() !== '') {
    return {
      apiKey: qwenApiKey.trim(),
      baseUrl: (process.env.QWEN_BASE_URL || 'https://api-inference.modelscope.cn/v1').trim(),
      modelId: (process.env.QWEN_ROUTER_MODEL || 'Qwen/Qwen3-8B').trim(),
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
      timeout: 15000 // 增加到 15 秒超时，防止网络卡顿导致通义千问超时
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

export async function queryMeituanTravelCLI(
  city: string,
  query: string,
  kind: TravelSupplyKind = "ticket"
): Promise<TicketSupplyResult> {
  const mtToken = process.env.MEITUAN_TRAVEL_TOKEN;
  if (!mtToken) {
    throw new TicketToolError('票务服务尚未配置', 'NOT_CONFIGURED');
  }

  // 动态注入 config.json 以兼容部署环境
  const mtConfigDir = path.join(os.homedir(), '.config', 'meituan-travel');
  if (!fs.existsSync(mtConfigDir)) {
    fs.mkdirSync(mtConfigDir, { recursive: true });
  }
  fs.writeFileSync(path.join(mtConfigDir, 'config.json'), JSON.stringify({ key: mtToken }), 'utf-8');

  let cliEntry: string;
  try {
    cliEntry = require.resolve('@meituan-travel/travel-cli/mttravel-bundle.cjs');
  } catch {
    throw new TicketToolError('票务查询组件未安装', 'CLI_UNAVAILABLE');
  }

  console.log(`Executing installed Meituan CLI (LangGraph): mttravel "${city}" "${query}"`);

  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [
      cliEntry,
      city.trim(),
      query.trim()
    ], {
      timeout: 45000,
      maxBuffer: 1024 * 1024 * 5,
      windowsHide: true,
      env: {
        ...process.env,
        MEITUAN_RAW_JSON: '1'
      }
    });

    if (stderr?.trim()) {
      console.log(`[Ticket Tool] CLI progress: ${stderr.trim()}`);
    }

    let payload: any;
    try {
      payload = JSON.parse(String(stdout).trim());
    } catch {
      throw new TicketToolError('票务服务返回了无法解析的数据', 'UPSTREAM_ERROR');
    }

    if (!payload?.success || payload?.code !== 0 || typeof payload?.data !== 'string') {
      throw new TicketToolError(payload?.msg || '票务服务查询失败', 'UPSTREAM_ERROR');
    }

    const content = payload.data
      .replace(/<\/answer>/gi, '')
      .replace(/提示：当前请求未传 channel[^\n]*/g, '')
      .trim();

    const isSoldOut = kind === "ticket"
      ? /无票|售罄|全部售完|暂无余票|没有可售/.test(content)
      : /无房|满房|售罄|暂无可订/.test(content);
    const hasBookingLink = /https?:\/\/dpurl\.cn\/[\w-]+/i.test(content);
    const hasConcreteService = kind === "hotel"
      ? /酒店|民宿|宾馆|客栈|评分|每晚|入住|房型/.test(content)
      : /(?:^|\W)(?:G|D|C|Z|T|K)\d{1,5}(?:\W|$)|(?:^|\W)[A-Z]{2}\d{3,4}(?:\W|$)/m.test(content);

    return {
      status: isSoldOut ? 'sold_out' : (hasBookingLink && hasConcreteService ? 'available' : 'summary_only'),
      content,
      traceId: payload.traceId ? String(payload.traceId) : undefined
    };
  } catch (error: any) {
    if (error instanceof TicketToolError) throw error;

    const message = String(error?.stderr || error?.message || 'unknown error');
    if (error?.code === 3 || /鉴权失败|token.*(?:无效|过期)/i.test(message)) {
      throw new TicketToolError('票务服务授权已失效', 'AUTH_FAILED');
    }
    if (error?.killed || error?.code === 'ETIMEDOUT' || /timed?\s*out|超时/i.test(message)) {
      throw new TicketToolError('票务服务响应超时', 'TIMEOUT');
    }
    if (error?.code === 'ENOENT') {
      throw new TicketToolError('票务查询组件不可用', 'CLI_UNAVAILABLE');
    }
    throw new TicketToolError('票务服务暂时不可用', 'UPSTREAM_ERROR');
  }
}
