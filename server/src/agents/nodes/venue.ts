import { ChatGraphState } from "../state.js";
import { getChatModel } from "../../lib/llm.js";
import { getGeneralSystemPrompt, getVenuePrompt, VENUE_UNACTIVATED_PROMPT } from "../prompts/systemPrompts.js";

export async function venueNode(state: typeof ChatGraphState.State) {
  console.log(`[Venue Node] Running shopping guide node. Activated link counts: ${state.venueLinks?.length || 0}`);

  let systemPrompt = getGeneralSystemPrompt(
    state.username,
    state.luckyElement,
    state.city
  );

  if (state.venueLinks && state.venueLinks.length > 0) {
    systemPrompt += getVenuePrompt(state.venueLinks);
  } else {
    console.warn(`[Venue Node] Warning: venueLinks was empty in venueNode!`);
    systemPrompt += VENUE_UNACTIVATED_PROMPT;
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
export type VenueNodeType = typeof venueNode;
