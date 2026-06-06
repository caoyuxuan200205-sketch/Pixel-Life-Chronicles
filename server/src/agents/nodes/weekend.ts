import { ChatGraphState } from "../state.js";
import { getChatModel } from "../../lib/llm.js";
import { getWeekendSystemPrompt, getVenuePrompt } from "../prompts/systemPrompts.js";
import { resolveTimelineConflicts } from "../utils/faultHandler.js";
import { queryRestaurantQueue, queryVenueTickets, fetchVenueCoupons } from "../tools/weekendTools.js";

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
        console.log(`[Weekend Node] Launching parallel tool queries for ${dealData.timeline.length} stops concurrently...`);
        
        // 1. Concurrently call tools for all stops in the timeline using Promise.all
        const promises = dealData.timeline.map(async (node: any) => {
          if (!node || typeof node.place !== 'string') return;
          const placeName = node.place;
          const isRestaurant = !!node.restaurantStatus || /餐|食|咖|火锅|店/.test(placeName);
          
          if (isRestaurant) {
            // Query queue and coupon concurrently
            const [queueRes, couponRes] = await Promise.all([
              queryRestaurantQueue(placeName),
              fetchVenueCoupons(placeName)
            ]);
            
            node.restaurantStatus = {
              queueStatus: queueRes.queueStatus,
              seatAvailability: queueRes.seatAvailability,
              fitFor: queueRes.fitFor
            };
            
            if (couponRes) {
              node.mysticReasoning = `${node.mysticReasoning || ''} 🎁 美团专享：[${couponRes.couponName}](${couponRes.couponLink})`;
            }
          } else {
            // Query ticket and coupon concurrently
            const [ticketRes, couponRes] = await Promise.all([
              queryVenueTickets(placeName),
              fetchVenueCoupons(placeName)
            ]);
            
            node.mysticReasoning = `${node.mysticReasoning || ''} \n${ticketRes.ticketStatus} [购票详情](${ticketRes.link})`;
            if (couponRes) {
              node.mysticReasoning = `${node.mysticReasoning || ''} 🎁 美团专享：[${couponRes.couponName}](${couponRes.couponLink})`;
            }
          }
        });
        
        await Promise.all(promises);
        console.log(`[Weekend Node] Parallel queries completed successfully. Now resolving conflicts...`);

        // 2. Resolve scheduling conflicts and seating status
        const { timeline, resolved } = resolveTimelineConflicts(dealData.timeline);
        
        dealData.timeline = timeline;
        // Re-serialize and replace in reply
        const newJson = JSON.stringify(dealData, null, 2);
        reply = reply.replace(weekendRegex, `<weekend_deal>\n${newJson}\n</weekend_deal>`);
        console.log(`[Weekend Node] Programmatic fault resolution and parallel tools merged.`);
      }
    } catch (e) {
      console.error(`[Weekend Node] Failed to parse/resolve conflicts in JSON:`, e);
    }
  }

  return { reply };
}
export type WeekendNodeType = typeof weekendNode;
