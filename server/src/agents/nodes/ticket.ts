import { ChatGraphState } from "../state.js";
import { queryMeituanTravelCLI, TicketToolError } from "../tools/ticketTools.js";
import { getChatModel } from "../../lib/llm.js";
import { TICKET_SYSTEM_PROMPT } from "../prompts/systemPrompts.js";
import { emitTrace } from "../trace.js";

export async function ticketNode(state: typeof ChatGraphState.State) {
  const isFlight = /航班|飞机|机票|机场|航线/.test(state.ticketParams.query);
  const label = isFlight ? "机票" : "火车票";
  emitTrace(state, { id: "ticket-supply", title: `查询${label}实时供给`, detail: `正在向美团旅行查询：${state.ticketParams.query}`, status: "running" });
  console.log(`[Ticket Node] Invoking ticket tools with params:`, state.ticketParams);
  let cliResultText = "";
  try {
    const supply = await queryMeituanTravelCLI(
      state.ticketParams.city,
      state.ticketParams.query
    );
    cliResultText = supply.content;
    console.log(`[Ticket Node] Meituan CLI success. status=${supply.status}, traceId=${supply.traceId || 'n/a'}, resultLength=${cliResultText.length}`);

    if (supply.status === 'sold_out') {
      emitTrace(state, { id: "ticket-supply", title: `查询${label}实时供给`, detail: "上游明确返回当前条件无票", status: "warning" });
      return {
        reply: `当前票务数据明确显示暂无可售${label}。为了避免误导，我不会生成虚假的班次或购买链接。你可以调整日期、出发地或时间范围后让我重新查询。`,
        ticketData: cliResultText
      };
    }

    if (supply.status === 'summary_only') {
      emitTrace(state, { id: "ticket-supply", title: `查询${label}实时供给`, detail: "上游只返回路线概览，缺少可核验班次、价格或购买链接", status: "warning" });
      return {
        reply: `美团票务服务目前只返回了路线类型概览，未提供可核验的具体车次、实时余票、价格和购买链接。为了避免误导，我暂不生成预订卡。你可以稍后重试，或先到铁路 12306 / 航司官方渠道查询实时票务。`,
        ticketData: cliResultText
      };
    }
  } catch (error: any) {
    const errorCode = error instanceof TicketToolError ? error.code : 'UPSTREAM_ERROR';
    console.error(`[Ticket Node] CLI execution failed. code=${errorCode}:`, error.message);
    const userMessage = errorCode === 'NOT_CONFIGURED'
      ? '票务查询服务尚未配置完成，请联系管理员补充服务端凭证。'
      : errorCode === 'AUTH_FAILED'
        ? '票务查询授权已失效，请联系管理员更新凭证。'
        : errorCode === 'TIMEOUT'
          ? '实时票务服务响应超时，请稍后重试。'
          : '实时票务服务暂时不可用，请稍后重试。';
    emitTrace(state, { id: "ticket-supply", title: `查询${label}实时供给`, detail: userMessage, status: "error" });
    return {
      reply: `${userMessage} 本次没有取得可核验的车次与余票，因此不会生成预订方案。`,
      ticketData: ''
    };
  }

  const links = cliResultText.match(/https?:\/\/dpurl\.cn\/[\w-]+/gi) || [];
  emitTrace(state, { id: "ticket-supply", title: `查询${label}实时供给`, detail: `已取得具体班次及 ${new Set(links).size} 个可核验购买入口`, status: "success" });
  emitTrace(state, { id: "ticket-compose", title: "整理真实票务方案", detail: "仅从接口结果提取班次、价格与原始链接", status: "running" });

  // Build message list for LangChain
  const messages = [...(state.messages || [])];
  
  // Inject CLI result as system context
  messages.push({
    role: "system",
    content: `【时空天命枢纽真实车票/机票供给数据】：
${cliResultText}

请你根据此真实供给数据，为探险者卜算并生成 <ticket_deal> 标记包裹的车票方案 JSON 数据！注意 options 里的链接必须是数据中对应的真实 dpurl.cn 链接，不得做任何修改！`
  });

  const llm = getChatModel();
  
  // Call llm.stream to enable streaming event capturing by streamEvents
  const responseStream = await llm.stream([
    { role: "system", content: TICKET_SYSTEM_PROMPT },
    ...messages.map(m => ({ role: m.role as any, content: m.content }))
  ], { tags: ["generation"] });

  let reply = "";
  for await (const chunk of responseStream) {
    reply += chunk.content;
  }
  emitTrace(state, { id: "ticket-compose", title: "整理真实票务方案", detail: "票务卡片已生成，未补造接口之外的数据", status: "success" });

  return {
    reply,
    ticketData: cliResultText
  };
}
