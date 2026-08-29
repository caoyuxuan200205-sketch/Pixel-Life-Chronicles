import { ChatGraphState } from "../state.js";
import { getRouterModel } from "../../lib/llm.js";
import { ROUTER_PROMPT } from "../prompts/systemPrompts.js";
import { extractTicketIntent } from "../tools/ticketTools.js";
import { emitTrace } from "../trace.js";

export async function routerNode(state: typeof ChatGraphState.State) {
  const messages = state.messages || [];
  const latestUserMsg = messages[messages.length - 1]?.content || "";

  console.log(`[Router Node] Checking intent for message: "${latestUserMsg}"`);
  emitTrace(state, { id: "route", title: "识别请求类型", detail: "正在分析这次需要调用的真实能力", status: "running" });

  const finishRoute = <T extends Record<string, any>>(result: T, detail: string) => {
    emitTrace(state, { id: "route", title: "识别请求类型", detail, status: "success" });
    return result;
  };

  // 1. Coupon Intent Bypass (Fast static regex for instant coupon deals)
  const isCouponIntent = /领券|领优惠|领红包|领取优惠|我要领券|我要领优惠|帮我领券|帮我领红包|领取红包|领取优惠券|领取美团券|领美团红包|领美团优惠|美团发券|美团领券|美团红包|美团优惠券|美团超级红包|美团专属红包|美团大额券|美团神券|美团隐藏券|美团隐藏优惠|美团福利|美团羊毛|美团薅羊毛|薅美团羊毛|美团省钱|美团怎么省钱|美团有什么优惠|美团有没有券|美团有红包吗|美团优惠怎么领|今天有什么优惠|今日优惠|今日红包|优惠券|美团券|美团优惠|薅羊毛|福利|羊毛|今日活动|今天有什么活动/.test(latestUserMsg);
  if (isCouponIntent) {
    console.log(`[Router Node] Detected 'coupon' intent via regex bypass.`);
    return finishRoute({ intent: "coupon" as const }, "识别为优惠领取请求");
  }

  // 2. Hotel intent uses Meituan travel supply directly instead of an LLM-generated hotel card.
  const isHotelIntent = /酒店|住宿|民宿|宾馆|旅馆|客栈|订房|房间|入住|住哪/.test(latestUserMsg);
  if (isHotelIntent) {
    return finishRoute({
      intent: "hotel" as const,
      hotelParams: { city: state.city, query: latestUserMsg }
    }, "识别为酒店实时查询");
  }

  // 3. Ticket Intent Extraction — 延迟调用：先用 regex 门卫拦截，只有命中票务关键词才调用 LLM 提取
  const hasTicketKeywords = /票|高铁|动车|火车|航班|飞机|车次|改签|候补|铁路|航线|机场/.test(latestUserMsg);
  if (hasTicketKeywords) {
    console.log(`[Router Node] Ticket keywords detected, calling extractTicketIntent LLM...`);
    const extraction = await extractTicketIntent(latestUserMsg, state.city);
    if (extraction.isTicketQuery) {
      console.log(`[Router Node] Detected 'ticket' intent. city=${extraction.city}, query=${extraction.query}`);
      return finishRoute({
        intent: "ticket" as const,
        ticketParams: { city: extraction.city, query: extraction.query }
      }, /航班|飞机|机票|机场|航线/.test(latestUserMsg) ? "识别为机票实时查询" : "识别为火车票实时查询");
    }
  } else {
    console.log(`[Router Node] No ticket keywords found, skipping extractTicketIntent LLM call.`);
  }

  // 3. Weekend Intent Bypass (regex 前置，跳过 LLM 分类)
  const isWeekendPlan = /周末|下午|朋友|老婆|带娃|减肥|安排|出去玩/.test(latestUserMsg);
  if (isWeekendPlan) {
    console.log(`[Router Node] Detected 'weekend' intent via regex bypass.`);
    return finishRoute({ intent: "weekend" as const }, "识别为连续行程规划");
  }

  // 4. Venue Intent Bypass (regex 前置，跳过 LLM 分类)
  const isVenueIntent = /外卖|送餐|配送|叫餐|奶茶|咖啡|下午茶|宵夜|早餐|午餐|晚餐|超市|便利店|鲜花|买花|水果|食材|零食|买酒|啤酒|饮料|美妆|日用品|数码|母婴|宠物|即时配送|堂食|团购|代金券|火锅|烧烤|餐厅|聚餐|约饭|餐饮团购|KTV|K歌|唱歌|电影|健身|洗浴|按摩|足疗|美甲|美睫|美发|剪头发|洗车|保养|摄影|亲子|游乐园|剧本杀|买药|送药|药店|药品|处方药|感冒药|退烧药|退热/.test(latestUserMsg);
  if (isVenueIntent) {
    console.log(`[Router Node] Detected 'venue' intent via regex bypass.`);
    return finishRoute({ intent: "venue" as const }, "识别为本地生活服务请求");
  }

  // 5. LLM classification — 仅当所有 regex 都无法匹配时才调用（兜底）
  try {
    const llm = getRouterModel();
    const response = await llm.invoke([
      { role: "system", content: ROUTER_PROMPT },
      { role: "user", content: latestUserMsg }
    ], {
      response_format: { type: "json_object" }
    });

    const content = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
    const parsed = JSON.parse(content.trim());
    const llmIntent = parsed.intent;

    if (["coupon", "ticket", "hotel", "weekend", "venue", "chat"].includes(llmIntent)) {
      console.log(`[Router Node] Classified as '${llmIntent}' via LLM.`);

      // 如果 LLM 分类为 ticket 但 regex 没拦住（极少数情况），延迟调用 extractTicketIntent
      if (llmIntent === "ticket" && !hasTicketKeywords) {
        console.log(`[Router Node] LLM caught ticket intent that regex missed, lazily calling extractTicketIntent...`);
        const extraction = await extractTicketIntent(latestUserMsg, state.city);
        return finishRoute({
          intent: "ticket" as const,
          ticketParams: { city: extraction.city || state.city, query: extraction.query || latestUserMsg }
        }, "识别为票务实时查询");
      }

      return finishRoute({ intent: llmIntent as any }, `识别为${llmIntent === "chat" ? "一般问答" : "专项服务"}`);
    }
  } catch (error) {
    console.error("[Router Node] LLM classification failed:", error);
  }

  // 6. Default fallback
  console.log(`[Router Node] Classified as 'chat' (default fallback).`);
  return finishRoute({ intent: "chat" as const }, "未命中专项服务，进入自然语言问答");
}
export type RouterNodeType = typeof routerNode;
