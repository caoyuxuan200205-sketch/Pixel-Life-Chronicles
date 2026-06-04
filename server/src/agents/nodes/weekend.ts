import { ChatGraphState } from "../state";
import { getChatModel } from "../../lib/llm";
import { getWeekendSystemPrompt, getVenuePrompt } from "../prompts/systemPrompts";

export async function weekendNode(state: typeof ChatGraphState.State) {
  console.log(`[Weekend Node] Synthesizing 4-6 hour trip timeline for user: ${state.username} with ${state.boundMembers?.length || 0} members`);

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

  return { reply };
}
export type WeekendNodeType = typeof weekendNode;
