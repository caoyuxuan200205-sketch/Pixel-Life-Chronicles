import axios from 'axios';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

function getAIConfig() {
  const apiKey = (process.env.QWEN_API_KEY || '').trim();
  const baseUrl = (process.env.QWEN_BASE_URL || 'https://api-inference.modelscope.cn/v1').trim();
  const modelId = (process.env.QWEN_MODEL || 'Qwen/Qwen3.5-35B-A3B').trim();
  return { apiKey, baseUrl, modelId };
}

interface TestCase {
  id: number;
  description: string;
  query: string;
  expectedTag: 'travel_deal' | 'ticket_deal' | 'none';
}

const TEST_SUITE: TestCase[] = [
  {
    id: 1,
    description: '常规周边温泉出游规划需求',
    query: '我想去个清静的地方泡温泉、吃土鸡，呼吸大自然',
    expectedTag: 'travel_deal'
  },
  {
    id: 2,
    description: '火车票真实供给查询需求',
    query: '请帮我订明天南京到上海的火车票，最好是早班车',
    expectedTag: 'ticket_deal'
  },
  {
    id: 3,
    description: '机票真实供给查询需求',
    query: '我下周五下午想飞北京，帮我看看南京到北京的机票航班',
    expectedTag: 'ticket_deal'
  },
  {
    id: 4,
    description: '纯命理解读与倾诉心里话',
    query: '祭司大人，我最近在工作上面临瓶颈，周末想换个气场充电，五行有什么指引吗？',
    expectedTag: 'none'
  }
];

async function runEvaluation() {
  console.log('🔮 ==========================================');
  console.log('🔮 Pixel Life Chronicles - LLM Evaluation Tool');
  console.log('🔮 ==========================================');

  const { apiKey, baseUrl, modelId } = getAIConfig();
  if (!apiKey) {
    console.error('❌ QWEN_API_KEY is missing in server environment. Aborting.');
    process.exit(1);
  }

  console.log(`Model Scope BaseUrl: ${baseUrl}`);
  console.log(`Evaluation Target Model: ${modelId}\n`);

  const results: any[] = [];
  let successCount = 0;

  for (const tc of TEST_SUITE) {
    console.log(`Testing Case ${tc.id}: [${tc.description}] ...`);
    const startTime = Date.now();

    try {
      const systemPrompt = `你是一位精通东方神秘学（八字五行、奇门遁甲）与现代旅行美学的"时空探路祭司"智能出行 Agent。
引导用户述说出游心里话，需要推荐时在文字的【最后】附带以下 XML 标记包裹的 JSON 数据：
周边游出游使用 <travel_deal>，车票/机票查询使用 <ticket_deal>。不要使用 markdown \`\`\`json 标记。`;

      const response = await axios.post(`${baseUrl}/chat/completions`, {
        model: modelId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: tc.query }
        ],
        temperature: 0.7,
        max_tokens: 800
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 45000
      });

      const latency = Date.now() - startTime;
      const content = response.data?.choices?.[0]?.message?.content || '';
      
      // 验证 XML 标记完备性
      let hasExpectedTag = false;
      if (tc.expectedTag === 'travel_deal') {
        hasExpectedTag = /<travel_deal>([\s\S]*?)<\/travel_deal>/.test(content);
      } else if (tc.expectedTag === 'ticket_deal') {
        hasExpectedTag = /<ticket_deal>([\s\S]*?)<\/ticket_deal>/.test(content);
      } else {
        hasExpectedTag = !/<(travel|ticket)_deal>/.test(content);
      }

      console.log(`✅ Success in ${latency}ms. XML Tag Correctness: ${hasExpectedTag ? 'PASS' : 'FAIL'}`);
      
      results.push({
        caseId: tc.id,
        description: tc.description,
        query: tc.query,
        latencyMs: latency,
        responseLength: content.length,
        expectedTag: tc.expectedTag,
        tagCheckPassed: hasExpectedTag,
        apiStatus: 'success',
        replyPreview: content.slice(0, 80) + '...'
      });

      if (hasExpectedTag) successCount++;

    } catch (err: any) {
      const latency = Date.now() - startTime;
      console.error(`❌ Failed Case ${tc.id}: ${err.message}`);
      results.push({
        caseId: tc.id,
        description: tc.description,
        query: tc.query,
        latencyMs: latency,
        apiStatus: 'failed',
        error: err.message
      });
    }
  }

  const report = {
    evaluatedAt: new Date().toISOString(),
    targetModel: modelId,
    totalTests: TEST_SUITE.length,
    passedChecks: successCount,
    passRate: `${Math.round((successCount / TEST_SUITE.length) * 100)}%`,
    testResults: results
  };

  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(path.join(dataDir, 'eval_report.json'), JSON.stringify(report, null, 2), 'utf-8');

  console.log('\n==========================================');
  console.log(`🏁 Evaluation completed. Pass Rate: ${report.passRate}`);
  console.log(`🏁 Report saved to: server/data/eval_report.json`);
  console.log('==========================================');
}

runEvaluation();
