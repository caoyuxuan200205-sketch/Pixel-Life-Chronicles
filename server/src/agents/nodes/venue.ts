import { ChatGraphState } from "../state.js";
import { getChatModel } from "../../lib/llm.js";
import { getGeneralSystemPrompt, getVenuePrompt, VENUE_UNACTIVATED_PROMPT } from "../prompts/systemPrompts.js";
import { emitTrace } from "../trace.js";

export async function venueNode(state: typeof ChatGraphState.State) {
  console.log(`[Venue Node] Running shopping guide node. Activated link counts: ${state.venueLinks?.length || 0}`);

  let systemPrompt = getGeneralSystemPrompt(
    state.username,
    state.luckyElement,
    state.city
  );

  if (state.venueLinks && state.venueLinks.length > 0) {
    emitTrace(state, { id: "venue-links", title: "加载本地生活入口", detail: `已加载 ${state.venueLinks.length} 个用户授权的真实导购入口`, status: "success" });
    systemPrompt += getVenuePrompt(state.venueLinks);
  } else {
    console.warn(`[Venue Node] Warning: venueLinks was empty in venueNode!`);
    systemPrompt += VENUE_UNACTIVATED_PROMPT;
    emitTrace(state, { id: "venue-links", title: "加载本地生活入口", detail: "尚未完成美团导购授权，本次不生成任何购买链接", status: "warning" });
  }

  emitTrace(state, { id: "venue-generate", title: "生成服务建议", detail: "正在依据可用的授权入口组织答复", status: "running" });

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
  emitTrace(state, { id: "venue-generate", title: "生成服务建议", detail: "服务建议已生成", status: "success" });

  return { reply };
}
export type VenueNodeType = typeof venueNode;
