import { ChatGraphState } from "../state.js";
import { getChatModel } from "../../lib/llm.js";
import { getWeekendSystemPrompt, getVenuePrompt } from "../prompts/systemPrompts.js";
import { resolveTimelineConflicts } from "../utils/faultHandler.js";

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

  // Post-processing to resolve scheduling conflicts and no seat exceptions
  const weekendRegex = /<weekend_deal>([\s\S]*?)<\/weekend_deal>/;
  const match = reply.match(weekendRegex);
  if (match) {
    try {
      const rawJson = match[1].trim();
      const dealData = JSON.parse(rawJson);
      if (dealData && Array.isArray(dealData.timeline)) {
        const { timeline, resolved } = resolveTimelineConflicts(dealData.timeline);
        if (resolved) {
          dealData.timeline = timeline;
          // Re-serialize and replace in reply
          const newJson = JSON.stringify(dealData, null, 2);
          reply = reply.replace(weekendRegex, `<weekend_deal>\n${newJson}\n</weekend_deal>`);
          console.log(`[Weekend Node] Programmatic fault resolution completed successfully.`);
        }
      }
    } catch (e) {
      console.error(`[Weekend Node] Failed to parse/resolve conflicts in JSON:`, e);
    }
  }

  return { reply };
}
export type WeekendNodeType = typeof weekendNode;
