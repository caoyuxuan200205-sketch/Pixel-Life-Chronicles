import { ChatGraphState } from "../state";
import { getChatModel } from "../../lib/llm";
import { ROUTER_PROMPT } from "../prompts/systemPrompts";
import { extractTicketIntent } from "../tools/ticketTools";

export async function routerNode(state: typeof ChatGraphState.State) {
  const messages = state.messages || [];
  const latestUserMsg = messages[messages.length - 1]?.content || "";

  console.log(`[Router Node] Checking intent for message: "${latestUserMsg}"`);

  // 1. Coupon Intent Bypass (Fast static regex for instant coupon deals)
  const isCouponIntent = /领券|领优惠|领红包|领取优惠|我要领券|我要领优惠|帮我领券|帮我领红包|领取红包|领取优惠券|领取美团券|领美团红包|领美团优惠|美团发券|美团领券|美团红包|美团优惠券|美团超级红包|美团专属红包|美团大额券|美团神券|美团隐藏券|美团隐藏优惠|美团福利|美团羊毛|美团薅羊毛|薅美团羊毛|美团省钱|美团怎么省钱|美团有什么优惠|美团有没有券|美团有红包吗|美团优惠怎么领|今天有什么优惠|今日优惠|今日红包|优惠券|美团券|美团优惠|薅羊毛|福利|羊毛|今日活动|今天有什么活动/.test(latestUserMsg);
  if (isCouponIntent) {
    console.log(`[Router Node] Detected 'coupon' intent via regex bypass.`);
    return { intent: "coupon" as const };
  }

  // 2. Ticket Intent Extraction
  const extraction = await extractTicketIntent(latestUserMsg, state.city);
  if (extraction.isTicketQuery) {
    console.log(`[Router Node] Detected 'ticket' intent. city=${extraction.city}, query=${extraction.query}`);
    return {
      intent: "ticket" as const,
      ticketParams: { city: extraction.city, query: extraction.query }
    };
  }

  // 3. LLM classification
  try {
    const llm = getChatModel();
    const response = await llm.invoke([
      { role: "system", content: ROUTER_PROMPT },
      { role: "user", content: latestUserMsg }
    ], {
      response_format: { type: "json_object" }
    });

    const content = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
    const parsed = JSON.parse(content.trim());
    const llmIntent = parsed.intent;

    if (["coupon", "ticket", "weekend", "venue", "chat"].includes(llmIntent)) {
      console.log(`[Router Node] Classified as '${llmIntent}' via LLM.`);
      return { intent: llmIntent as any };
    }
  } catch (error) {
    console.error("[Router Node] LLM classification failed, falling back to regex:", error);
  }

  // 4. Fallback regex checks
  const isWeekendPlan = /周末|下午|朋友|老婆|带娃|减肥|安排|出去玩/.test(latestUserMsg);
  if (isWeekendPlan) {
    console.log(`[Router Node] Classified as 'weekend' via fallback regex.`);
    return { intent: "weekend" as const };
  }

  const isVenueIntent = /外卖|送餐|配送|叫餐|奶茶|咖啡|下午茶|宵夜|早餐|午餐|晚餐|超市|便利店|鲜花|买花|水果|食材|零食|买酒|啤酒|饮料|美妆|日用品|数码|母婴|宠物|即时配送|堂食|团购|代金券|火锅|烧烤|餐厅|聚餐|约饭|餐饮团购|KTV|K歌|唱歌|电影|健身|洗浴|按摩|足疗|美甲|美睫|美发|剪头发|洗车|保养|摄影|亲子|游乐园|剧本杀|买药|送药|药店|药品|处方药|感冒药|退烧药|退热/.test(latestUserMsg);
  if (isVenueIntent) {
    console.log(`[Router Node] Classified as 'venue' via fallback regex.`);
    return { intent: "venue" as const };
  }

  console.log(`[Router Node] Classified as 'chat' (default fallback).`);
  return { intent: "chat" as const };
}
export type RouterNodeType = typeof routerNode;
