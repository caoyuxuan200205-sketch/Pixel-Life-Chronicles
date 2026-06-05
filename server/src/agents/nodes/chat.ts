import { ChatGraphState } from "../state.js";
import { getChatModel } from "../../lib/llm.js";
import { getGeneralSystemPrompt, VENUE_UNACTIVATED_PROMPT } from "../prompts/systemPrompts.js";

export async function chatNode(state: typeof ChatGraphState.State) {
  console.log(`[Chat Node] Handling chat interaction for user: ${state.username}`);

  let systemPrompt = getGeneralSystemPrompt(
    state.username,
    state.luckyElement,
    state.city
  );

  // If Meituan guide is not activated, but user mentions venue terms, guide them to activate.
  const messages = state.messages || [];
  const latestUserMsg = messages[messages.length - 1]?.content || "";
  const isVenueIntent = /外卖|送餐|配送|叫餐|奶茶|咖啡|下午茶|宵夜|早餐|午餐|晚餐|超市|便利店|鲜花|买花|水果|食材|零食|买酒|啤酒|饮料|美妆|日用品|数码|母婴|宠物|即时配送|堂食|团购|代金券|火锅|烧烤|餐厅|聚餐|约饭|餐饮团购|KTV|K歌|唱歌|电影|健身|洗浴|按摩|足疗|美甲|美睫|美发|剪头发|洗车|保养|摄影|亲子|游乐园|剧本杀|买药|送药|药店|药品|处方药|感冒药|退烧药|退热/.test(latestUserMsg);

  if (isVenueIntent && (!state.venueLinks || state.venueLinks.length === 0)) {
    console.log(`[Chat Node] Guide unactivated Meituan guide.`);
    systemPrompt += VENUE_UNACTIVATED_PROMPT;
  }

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
export type ChatNodeType = typeof chatNode;
