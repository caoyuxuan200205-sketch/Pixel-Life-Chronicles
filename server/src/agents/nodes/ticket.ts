import { ChatGraphState } from "../state";
import { queryMeituanTravelCLI } from "../tools/ticketTools";
import { getChatModel } from "../../lib/llm";
import { TICKET_SYSTEM_PROMPT } from "../prompts/systemPrompts";

export async function ticketNode(state: typeof ChatGraphState.State) {
  console.log(`[Ticket Node] Invoking ticket tools with params:`, state.ticketParams);
  let cliResultText = "";
  try {
    cliResultText = await queryMeituanTravelCLI(
      state.ticketParams.city,
      state.ticketParams.query
    );
    console.log(`[Ticket Node] Meituan CLI success. Result length: ${cliResultText.length}`);
  } catch (error: any) {
    console.error(`[Ticket Node] CLI execution failed:`, error.message);
    cliResultText = `时空枢纽在现实票务系统对接中发生波动：${error.message}`;
  }

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

  return {
    reply,
    ticketData: cliResultText
  };
}
