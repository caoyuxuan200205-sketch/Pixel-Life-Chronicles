import { ChatOpenAI } from "@langchain/openai";

export function getChatModel(): ChatOpenAI {
  const qwenApiKey = process.env.QWEN_API_KEY;
  console.log(`[getChatModel] Initializing chat model. QWEN_API_KEY length: ${qwenApiKey?.length || 0}, DOUBAO_API_KEY length: ${process.env.DOUBAO_API_KEY?.length || 0}`);
  
  if (qwenApiKey && qwenApiKey !== 'YOUR_QWEN_API_KEY_HERE' && qwenApiKey.trim() !== '') {
    const qwenModel = (process.env.QWEN_MODEL || 'Qwen/Qwen3.5-35B-A3B').trim();
    console.log(`[getChatModel] Choosing Qwen. Model ID: ${qwenModel}`);
    return new ChatOpenAI({
      apiKey: qwenApiKey.trim(),
      configuration: {
        baseURL: (process.env.QWEN_BASE_URL || 'https://api-inference.modelscope.cn/v1').trim(),
        timeout: 20000, // 增加到 20 秒超时，给予通义千问充足的响应时间
      },
      modelName: qwenModel,
      temperature: 0.7,
    });
  }

  // Fallback to Doubao
  const doubaoApiKey = (process.env.DOUBAO_API_KEY || process.env.VITE_DOUBAO_API_KEY || '').trim();
  const doubaoModelId = (process.env.DOUBAO_MODEL_ID || process.env.VITE_DOUBAO_MODEL_ID || '').trim();

  console.log(`[getChatModel] Falling back to Doubao. Model ID: ${doubaoModelId}`);
  return new ChatOpenAI({
    apiKey: doubaoApiKey,
    configuration: {
      baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
    },
    modelName: doubaoModelId,
    temperature: 0.7,
  });
}
export type LLMType = ChatOpenAI;

export function getRouterModel(): ChatOpenAI {
  const qwenApiKey = process.env.QWEN_API_KEY;
  const routerModelName = (process.env.QWEN_ROUTER_MODEL || 'Qwen/Qwen3-8B').trim();

  if (qwenApiKey && qwenApiKey !== 'YOUR_QWEN_API_KEY_HERE' && qwenApiKey.trim() !== '') {
    console.log(`[getRouterModel] Using lightweight router model: ${routerModelName}`);
    return new ChatOpenAI({
      apiKey: qwenApiKey.trim(),
      configuration: {
        baseURL: (process.env.QWEN_BASE_URL || 'https://api-inference.modelscope.cn/v1').trim(),
        timeout: 10000, // Router 需要快速响应，10 秒超时
      },
      modelName: routerModelName,
      temperature: 0.1, // 低温度，确保分类结果稳定
    });
  }

  // Fallback: 如果没有配置 Qwen，退回主模型
  return getChatModel();
}
