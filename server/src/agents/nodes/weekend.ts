import { ChatGraphState } from "../state.js";
import { getChatModel } from "../../lib/llm.js";
import { getWeekendSystemPrompt, getVenuePrompt } from "../prompts/systemPrompts.js";
import { emitTrace } from "../trace.js";

export async function weekendNode(state: typeof ChatGraphState.State) {
  console.log(`[Weekend Node] Synthesizing 4-6 hour trip timeline for user: ${state.username} with ${state.boundMembers?.length || 0} members`);
  emitTrace(state, { id: "weekend-plan", title: "生成连续行程草案", detail: "正在结合同行人、偏好与命理信息编排行程", status: "running" });

  let systemPrompt = getWeekendSystemPrompt(
    state.username,
    state.luckyElement,
    state.city,
    state.boundMembers || []
  );

  // Also enable Meituan service link guides if activated
  if (state.venueLinks && state.venueLinks.length > 0) {
    systemPrompt += getVenuePrompt(state.venueLinks);
  }

  const messages = state.messages || [];
  const llm = getChatModel();
  const responseStream = await llm.stream([
    { role: "system", content: systemPrompt },
    ...messages.map(m => ({ role: m.role as any, content: m.content }))
  ], { tags: ["generation"] });

  let reply = "";
  for await (const chunk of responseStream) {
    reply += chunk.content;
  }
  emitTrace(state, { id: "weekend-plan", title: "生成连续行程草案", detail: "行程草案已完成", status: "success" });
  emitTrace(state, { id: "weekend-realtime", title: "核验商户实时状态", detail: "当前没有排队、余票和优惠实时数据源，已停用原模拟数据，不展示伪造状态", status: "warning" });

  return { reply };
}
export type WeekendNodeType = typeof weekendNode;
