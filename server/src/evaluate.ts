import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { getChatModel } from './lib/llm.js';
import { routerNode } from './agents/nodes/router.js';
import {
  getGeneralSystemPrompt,
  getWeekendSystemPrompt,
  TICKET_SYSTEM_PROMPT
} from './agents/prompts/systemPrompts.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TestCase {
  id: number;
  scenario: 'router' | 'travel_deal' | 'ticket_deal' | 'weekend_deal' | 'venue' | 'coupon' | 'chat';
  description: string;
  query: string;
  context: {
    username: string;
    luckyElement: string;
    city: string;
    boundMembers?: any[];
    ticketSupplies?: string;
  };
  expectedIntent?: string;
  expectedTag?: 'travel_deal' | 'ticket_deal' | 'weekend_deal' | 'none';
}

interface EvaluationResult {
  id: number;
  scenario: string;
  description: string;
  query: string;
  latencyMs: number;
  routerStatus: 'PASS' | 'FAIL' | 'SKIPPED';
  routerResult?: string;
  tagStatus: 'PASS' | 'FAIL' | 'SKIPPED';
  tagResult?: string;
  jsonParsed: boolean;
  jsonValidationError?: string;
  hasMarkdownBlockInTag: boolean;
  linkHallucinationFree: 'PASS' | 'FAIL' | 'SKIPPED';
  luckyElementAligned: boolean;
  error?: string;
  responsePreview?: string;
}

// 并发控制函数
async function runWithConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  const executing: Promise<any>[] = [];
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const p = fn(item).then((res) => {
      results[i] = res;
      executing.splice(executing.indexOf(p), 1);
    });
    executing.push(p);
    if (executing.length >= limit) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
  return results;
}

// JSON Schema / 规则校验
function validateJson(tag: string, data: any, contextSupplies?: string): { valid: boolean; reason?: string } {
  try {
    if (tag === 'travel_deal') {
      const required = ['hotel', 'scenic', 'auspiciousHour'];
      for (const req of required) {
        if (!data[req]) return { valid: false, reason: `Missing root field: ${req}` };
      }
      // Hotel validation
      const hotel = data.hotel;
      if (!hotel.name || !hotel.price || !hotel.desc || !hotel.rating || !hotel.tag || !hotel.room) {
        return { valid: false, reason: 'Hotel is missing required fields (name, price, desc, rating, tag, or room)' };
      }
      if (!hotel.name.includes('🏨')) {
        return { valid: false, reason: 'Hotel name should start with icon 🏨' };
      }
      // Scenic validation
      const scenic = data.scenic;
      if (!scenic.name || !scenic.price || !scenic.desc || !scenic.rating || !scenic.tag) {
        return { valid: false, reason: 'Scenic is missing required fields (name, price, desc, rating, or tag)' };
      }
      if (!scenic.name.includes('🏕️')) {
        return { valid: false, reason: 'Scenic name should start with icon 🏕️' };
      }
    } else if (tag === 'ticket_deal') {
      const required = ['type', 'from', 'to', 'date', 'options'];
      for (const req of required) {
        if (!data[req]) return { valid: false, reason: `Missing root field: ${req}` };
      }
      if (data.type !== 'train' && data.type !== 'flight') {
        return { valid: false, reason: `Invalid ticket type: ${data.type}` };
      }
      if (!Array.isArray(data.options) || data.options.length === 0) {
        return { valid: false, reason: 'Options must be a non-empty array' };
      }
      for (const opt of data.options) {
        const optReq = ['number', 'fromTime', 'toTime', 'duration', 'seatType', 'price', 'link', 'desc'];
        for (const oReq of optReq) {
          if (opt[oReq] === undefined || opt[oReq] === null) {
            return { valid: false, reason: `Option is missing field: ${oReq}` };
          }
        }
        if (!opt.link.includes('dpurl.cn')) {
          return { valid: false, reason: `Ticket purchase link must be a dpurl.cn link: ${opt.link}` };
        }
      }
    } else if (tag === 'weekend_deal') {
      if (!data.divinationSynthesis) {
        return { valid: false, reason: 'Missing divinationSynthesis' };
      }
      if (!Array.isArray(data.timeline) || data.timeline.length < 2) {
        return { valid: false, reason: 'Timeline must be an array with at least 2 steps' };
      }
      for (const step of data.timeline) {
        if (!step.time || !step.place || !step.tag || !step.mysticReasoning) {
          return { valid: false, reason: 'Timeline step is missing required fields (time, place, tag, or mysticReasoning)' };
        }
      }
    }
    return { valid: true };
  } catch (e: any) {
    return { valid: false, reason: `Validation execution crash: ${e.message}` };
  }
}

// 检查车票链接是否属于输入供给数据中的链接（防止幻觉）
function checkLinkHallucination(data: any, supplies?: string): 'PASS' | 'FAIL' {
  if (!supplies || !data || !Array.isArray(data.options)) return 'PASS';
  
  // 提取供给中的所有 dpurl.cn 链接
  const supplyLinks: string[] = [];
  const linkRegex = /https?:\/\/dpurl\.cn\/[a-zA-Z0-9]+/g;
  let match;
  while ((match = linkRegex.exec(supplies)) !== null) {
    supplyLinks.push(match[0].trim());
  }

  // 如果无票状态且备选方案里也是 dpurl 链接，我们也将它们加入白名单
  // 从代码可以看出备选有 http://dpurl.cn/iaGyLrrz 和 http://dpurl.cn/420XUhvz
  supplyLinks.push('http://dpurl.cn/iaGyLrrz');
  supplyLinks.push('http://dpurl.cn/420XUhvz');

  for (const opt of data.options) {
    const generatedLink = (opt.link || '').trim();
    if (!generatedLink) continue;
    // 检查模型生成的链接是否在供给列表或默认白名单里
    const isMatched = supplyLinks.some(sLink => {
      // 简单模糊匹配（去除 http/https 协议头干扰）
      const cleanS = sLink.replace(/^https?:\/\//, '');
      const cleanG = generatedLink.replace(/^https?:\/\//, '');
      return cleanG.includes(cleanS) || cleanS.includes(cleanG);
    });
    if (!isMatched) {
      console.warn(`⚠️ Detected Link Hallucination! Generated: "${generatedLink}", Supplies had: ${JSON.stringify(supplyLinks)}`);
      return 'FAIL';
    }
  }
  return 'PASS';
}

async function runEvaluation() {
  console.log('🔮 ==========================================');
  console.log('🔮 Pixel Life Chronicles - LLM Evaluation v2');
  console.log('🔮 ==========================================');

  const testCasesPath = path.join(__dirname, 'agents', 'prompts', 'testCases.json');
  if (!fs.existsSync(testCasesPath)) {
    console.error(`❌ Test cases file not found at ${testCasesPath}`);
    process.exit(1);
  }

  const testCases: TestCase[] = JSON.parse(fs.readFileSync(testCasesPath, 'utf-8'));
  console.log(`Loaded ${testCases.length} evaluation cases from testCases.json.\n`);

  const results = await runWithConcurrencyLimit(testCases, 3, async (tc): Promise<EvaluationResult> => {
    console.log(`[Case ${tc.id}] Evaluating Scenario: ${tc.scenario}...`);
    const startTime = Date.now();
    const resultItem: EvaluationResult = {
      id: tc.id,
      scenario: tc.scenario,
      description: tc.description,
      query: tc.query,
      latencyMs: 0,
      routerStatus: 'SKIPPED',
      tagStatus: 'SKIPPED',
      jsonParsed: false,
      hasMarkdownBlockInTag: false,
      linkHallucinationFree: 'SKIPPED',
      luckyElementAligned: false
    };

    try {
      // 1. 意图分类测试
      if (tc.expectedIntent) {
        try {
          const routerState = {
            messages: [{ role: 'user', content: tc.query }],
            city: tc.context.city || '南京',
            luckyElement: tc.context.luckyElement || '金',
            username: tc.context.username || '探索者',
            boundMembers: (tc as any).boundMembers || [],
            venueLinks: []
          };
          const routeRes = await routerNode(routerState as any);
          resultItem.routerResult = routeRes.intent;
          resultItem.routerStatus = routeRes.intent === tc.expectedIntent ? 'PASS' : 'FAIL';
        } catch (routerErr: any) {
          resultItem.routerStatus = 'FAIL';
          resultItem.error = `Router error: ${routerErr.message}`;
        }
      }

      // 2. 卡片与回复生成测试
      if (tc.expectedTag) {
        let systemPrompt = '';
        const userMsgs: any[] = [];

        if (tc.scenario === 'travel_deal') {
          systemPrompt = getGeneralSystemPrompt(
            tc.context.username,
            tc.context.luckyElement,
            tc.context.city
          );
        } else if (tc.scenario === 'weekend_deal') {
          systemPrompt = getWeekendSystemPrompt(
            tc.context.username,
            tc.context.luckyElement,
            tc.context.city,
            tc.context.boundMembers || []
          );
        } else if (tc.scenario === 'ticket_deal') {
          systemPrompt = TICKET_SYSTEM_PROMPT;
          if (tc.context.ticketSupplies) {
            userMsgs.push({
              role: 'system',
              content: tc.context.ticketSupplies
            });
          }
        } else {
          // 其他默认采用通用祭司 prompt
          systemPrompt = getGeneralSystemPrompt(
            tc.context.username,
            tc.context.luckyElement,
            tc.context.city
          );
        }

        userMsgs.push({ role: 'user', content: tc.query });

        const llm = getChatModel();
        const response = await llm.invoke([
          { role: 'system', content: systemPrompt },
          ...userMsgs
        ]);

        const reply = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
        resultItem.responsePreview = reply.slice(0, 150) + (reply.length > 150 ? '...' : '');

        // 验证 XML 标签
        const expectedTag = tc.expectedTag;
        if (expectedTag === 'none') {
          // 应该没有包含任何 XML 卡片
          const hasXml = /<(travel_deal|ticket_deal|weekend_deal)>/.test(reply);
          resultItem.tagStatus = hasXml ? 'FAIL' : 'PASS';
          resultItem.tagResult = 'none';
        } else {
          const tagRegex = new RegExp(`<(${expectedTag})>([\\s\\S]*?)<\\/\\1>`);
          const match = reply.match(tagRegex);
          
          if (!match) {
            resultItem.tagStatus = 'FAIL';
            resultItem.tagResult = `Missing expected tag <${expectedTag}>`;
          } else {
            resultItem.tagResult = expectedTag;
            const rawJsonContent = match[2];
            
            // 检查标签内部是否带了 markdown 的 ``` 符号
            resultItem.hasMarkdownBlockInTag = rawJsonContent.includes('```');
            
            // 尝试解析 JSON
            let cleanJsonText = rawJsonContent.trim();
            if (cleanJsonText.startsWith('```json')) {
              cleanJsonText = cleanJsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            } else if (cleanJsonText.startsWith('```')) {
              cleanJsonText = cleanJsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }

            try {
              const parsed = JSON.parse(cleanJsonText);
              resultItem.jsonParsed = true;
              
              // 字段深度格式校验
              const validation = validateJson(expectedTag, parsed, tc.context.ticketSupplies);
              if (validation.valid) {
                resultItem.tagStatus = 'PASS';
              } else {
                resultItem.tagStatus = 'FAIL';
                resultItem.jsonValidationError = validation.reason;
              }

              // 防车票幻觉校验
              if (expectedTag === 'ticket_deal') {
                resultItem.linkHallucinationFree = checkLinkHallucination(parsed, tc.context.ticketSupplies);
              }
            } catch (jsonErr: any) {
              resultItem.jsonParsed = false;
              resultItem.tagStatus = 'FAIL';
              resultItem.jsonValidationError = `JSON Parse Error: ${jsonErr.message}`;
            }
          }
        }

        // 校验五行元素贴合度
        if (tc.context.luckyElement) {
          resultItem.luckyElementAligned = reply.includes(tc.context.luckyElement) || reply.includes('五行');
        }
      }

    } catch (err: any) {
      resultItem.error = err.message;
      if (tc.expectedIntent) resultItem.routerStatus = 'FAIL';
      if (tc.expectedTag) resultItem.tagStatus = 'FAIL';
    } finally {
      resultItem.latencyMs = Date.now() - startTime;
      console.log(`[Case ${tc.id}] Done in ${resultItem.latencyMs}ms. Router: ${resultItem.routerStatus}, Tag: ${resultItem.tagStatus}`);
    }

    return resultItem;
  });

  // 聚合统计
  const total = testCases.length;
  let routerPassed = 0;
  let routerTotal = 0;
  let tagPassed = 0;
  let tagTotal = 0;
  let jsonCompliancePassed = 0;
  let jsonComplianceTotal = 0;
  let linkHallucinationPassed = 0;
  let linkHallucinationTotal = 0;
  let elementAlignmentPassed = 0;
  let elementAlignmentTotal = 0;
  let totalLatency = 0;

  for (const r of results) {
    totalLatency += r.latencyMs;
    if (r.routerStatus !== 'SKIPPED') {
      routerTotal++;
      if (r.routerStatus === 'PASS') routerPassed++;
    }
    if (r.tagStatus !== 'SKIPPED') {
      tagTotal++;
      if (r.tagStatus === 'PASS') tagPassed++;
      
      const tc = testCases.find(t => t.id === r.id);
      if (tc && tc.expectedTag !== 'none') {
        jsonComplianceTotal++;
        if (r.jsonParsed && !r.jsonValidationError) jsonCompliancePassed++;
      }
    }
    if (r.linkHallucinationFree !== 'SKIPPED') {
      linkHallucinationTotal++;
      if (r.linkHallucinationFree === 'PASS') linkHallucinationPassed++;
    }
    const tc = testCases.find(t => t.id === r.id);
    if (tc && tc.context.luckyElement && tc.expectedTag && tc.expectedTag !== 'none') {
      elementAlignmentTotal++;
      if (r.luckyElementAligned) elementAlignmentPassed++;
    }
  }

  const routerPassRate = routerTotal > 0 ? Math.round((routerPassed / routerTotal) * 100) : 100;
  const tagPassRate = tagTotal > 0 ? Math.round((tagPassed / tagTotal) * 100) : 100;
  const jsonComplianceRate = jsonComplianceTotal > 0 ? Math.round((jsonCompliancePassed / jsonComplianceTotal) * 100) : 100;
  const linkHallucinationFreeRate = linkHallucinationTotal > 0 ? Math.round((linkHallucinationPassed / linkHallucinationTotal) * 100) : 100;
  const elementAlignmentRate = elementAlignmentTotal > 0 ? Math.round((elementAlignmentPassed / elementAlignmentTotal) * 100) : 100;
  const avgLatency = Math.round(totalLatency / total);

  const report = {
    evaluatedAt: new Date().toISOString(),
    totalTests: total,
    avgLatencyMs: avgLatency,
    summary: {
      routerAccuracy: `${routerPassRate}% (${routerPassed}/${routerTotal})`,
      xmlTagPassRate: `${tagPassRate}% (${tagPassed}/${tagTotal})`,
      jsonSchemaCompliance: `${jsonComplianceRate}% (${jsonCompliancePassed}/${jsonComplianceTotal})`,
      linkHallucinationFreeRate: `${linkHallucinationFreeRate}% (${linkHallucinationPassed}/${linkHallucinationTotal})`,
      luckyElementAlignmentRate: `${elementAlignmentRate}% (${elementAlignmentPassed}/${elementAlignmentTotal})`
    },
    testResults: results
  };

  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // 保存 JSON 原始报告
  fs.writeFileSync(path.join(dataDir, 'eval_report.json'), JSON.stringify(report, null, 2), 'utf-8');

  // 生成漂亮的 Markdown Dashboard 报告
  const dashboardContent = `# 🔮 Pixel Life Chronicles - LLM 评测看板

**评测时间**: ${report.evaluatedAt}
**运行环境模型**: ${process.env.QWEN_MODEL || '默认/混合'}

## 📊 指标综合面板

| 评估指标 | 达标率 | 详情 | 说明 |
| :--- | :--- | :--- | :--- |
| **路由准确率 (Router Accuracy)** | **${report.summary.routerAccuracy}** | 验证意图分类器路由准确度 | 避免误判导致错误节点响应 |
| **卡片生成通过率 (XML Tag Pass)** | **${report.summary.xmlTagPassRate}** | 期望的 XML 标记生成正确率 | 保证卡片被正确输出 |
| **JSON Schema 合规率 (JSON Compliance)** | **${report.summary.jsonSchemaCompliance}** | XML 内 JSON 结构无错且完整 | **杜绝因结构畸变导致的前端崩溃** |
| **车票防幻觉率 (No Link Hallucination)** | **${report.summary.linkHallucinationFreeRate}** | 车票/机票购买链接无虚构编造 | 确保购票与抢票跳转真实性 |
| **玄学元素契合度 (Mystic Alignment)** | **${report.summary.luckyElementAlignmentRate}** | 输出描述对齐用户幸运五行 | 维系八字开运旅行的人设 |
| **平均请求延迟 (Avg Latency)** | **${report.avgLatencyMs}ms** | 并发环境下模型平均时延 | 关注线上用户等待体验 |

---

## 📝 详细评测条目明细

| ID | 场景 | 测试用例描述 | 路由结果 | 卡片生成 | JSON 结构 | 链接防幻觉 | 耗时(ms) | 校验详情/错误摘要 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
${results.map(r => {
  const routerIcon = r.routerStatus === 'PASS' ? '🟢 PASS' : (r.routerStatus === 'FAIL' ? `🔴 FAIL (${r.routerResult})` : '⚪ SKIP');
  const tagIcon = r.tagStatus === 'PASS' ? '🟢 PASS' : (r.tagStatus === 'FAIL' ? '🔴 FAIL' : '⚪ SKIP');
  const jsonIcon = r.tagStatus === 'SKIPPED' ? '⚪' : (r.jsonParsed ? (r.jsonValidationError ? '🔴 INVALID' : '🟢 OK') : '🔴 ERROR');
  const hallucinationIcon = r.linkHallucinationFree === 'PASS' ? '🟢 OK' : (r.linkHallucinationFree === 'FAIL' ? '🔴 HALLUCINATED' : '⚪');
  const details = r.error || r.jsonValidationError || (r.hasMarkdownBlockInTag ? '⚠️ 包含 Markdown 代码块标记' : '格式正常');
  
  return `| ${r.id} | \`${r.scenario}\` | ${r.description} | ${routerIcon} | ${tagIcon} | ${jsonIcon} | ${hallucinationIcon} | ${r.latencyMs} | ${details} |`;
}).join('\n')}

---

> [!NOTE]
> 本报告由系统自动生成。开发人员可通过配置 \`server/src/agents/prompts/testCases.json\` 自行扩充测试场景。如遇 JSON 格式崩溃或幻觉链接，请根据错误详情定向微调对应的 System Prompt 约束。
`;

  fs.writeFileSync(path.join(dataDir, 'eval_report_dashboard.md'), dashboardContent, 'utf-8');

  console.log('\n==========================================');
  console.log(`🏁 Evaluation completed.`);
  console.log(`🏁 JSON Report: server/data/eval_report.json`);
  console.log(`🏁 Markdown Dashboard: server/data/eval_report_dashboard.md`);
  console.log('==========================================');
}

runEvaluation();
