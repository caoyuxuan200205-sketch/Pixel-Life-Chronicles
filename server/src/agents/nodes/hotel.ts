import { ChatGraphState } from "../state.js";
import { emitTrace } from "../trace.js";
import { queryMeituanTravelCLI, TicketToolError } from "../tools/ticketTools.js";

interface HotelCardData {
  name: string;
  image: string;
  link: string;
  category: string;
  rating: string;
  opening: string;
  price: string;
  perks: string[];
  distance: string;
  description: string;
}

interface HotelDealData {
  checkIn: string;
  destination: string;
  source: string;
  hotels: HotelCardData[];
  note: string;
}

function cleanMarkdown(value: string) {
  return value
    .replace(/\\([()])/g, "$1")
    .replace(/\*\*/g, "")
    .trim();
}

export function parseHotelSupply(content: string): HotelDealData | null {
  const hotelPattern = /!\[[^\]]*\]\((https?:\/\/[^)]+)\)\s*\n\[\*\*([\s\S]*?)\*\*\]\((https?:\/\/dpurl\.cn\/[^)]+)\)\s*([^\n]*)\n([^\n]+)/g;
  const hotels: HotelCardData[] = [];
  let match: RegExpExecArray | null;
  let lastMatchEnd = 0;

  while ((match = hotelPattern.exec(content)) !== null) {
    const meta = cleanMarkdown(match[4]);
    const description = cleanMarkdown(match[5]);
    const category = meta.match(/美团([^\s]+型)/)?.[1] || "酒店";
    const rating = meta.match(/美团真实评分\s*([\d.]+)/)?.[1] || "";
    const opening = meta.match(/(\d{4}\/\d{2}开业)/)?.[1] || "";
    const price = meta.match(/(￥[^\s]+(?:\/晚)?)/)?.[1] || "";
    const distance = description.match(/(?:仅|约)?\s*([\d.]+公里)/)?.[1] || "";
    const perksText = meta
      .replace(/美团[^\s]+型/g, "")
      .replace(/美团真实评分\s*[\d.]+/g, "")
      .replace(/\d{4}\/\d{2}开业/g, "")
      .replace(/￥[^\s]+(?:\/晚)?/g, "")
      .trim();

    hotels.push({
      name: cleanMarkdown(match[2]),
      image: match[1].replace(/^http:/, "https:"),
      link: match[3],
      category,
      rating,
      opening,
      price,
      perks: perksText ? perksText.split(/\s+/).filter(Boolean) : [],
      distance,
      description
    });
    lastMatchEnd = hotelPattern.lastIndex;
  }

  if (hotels.length === 0) return null;

  const intro = cleanMarkdown(content.slice(0, content.indexOf("##")));
  const checkIn = intro.match(/(\d{1,2}月\d{1,2}日)入住/)?.[1] || "";
  const destination = intro.match(/位于([^，。]+?)附近/)?.[1] || "";
  const tail = cleanMarkdown(content.slice(lastMatchEnd).replace(/^\s*##[^\n]*\n?/, ""));

  return {
    checkIn,
    destination,
    source: "美团旅行实时供给",
    hotels,
    note: tail
  };
}

export async function hotelNode(state: typeof ChatGraphState.State) {
  const params = state.hotelParams;
  emitTrace(state, {
    id: "hotel-supply",
    title: "查询酒店实时供给",
    detail: `正在向美团旅行查询：${params.query}`,
    status: "running"
  });

  try {
    const supply = await queryMeituanTravelCLI(params.city, params.query, "hotel");
    if (supply.status === "sold_out") {
      emitTrace(state, { id: "hotel-supply", title: "查询酒店实时供给", detail: "上游返回当前条件暂无可订房源", status: "warning" });
      return { reply: "当前条件下没有查到可订房源。我不会生成虚假的酒店、价格或预订链接；你可以调整入住日期、商圈或预算后让我重新查询。" };
    }
    if (supply.status === "summary_only") {
      emitTrace(state, { id: "hotel-supply", title: "查询酒店实时供给", detail: "上游只返回概览，缺少可核验酒店与预订链接", status: "warning" });
      return { reply: "美团旅行本次只返回了酒店概览，没有提供可核验的具体酒店、实时价格与预订链接。为了避免误导，我不会生成酒店卡片，请稍后重试或补充入住日期和商圈。" };
    }

    const links = supply.content.match(/https?:\/\/dpurl\.cn\/[\w-]+/gi) || [];
    const hotelDeal = parseHotelSupply(supply.content);
    emitTrace(state, {
      id: "hotel-supply",
      title: "查询酒店实时供给",
      detail: hotelDeal
        ? `已取得并结构化 ${hotelDeal.hotels.length} 家真实酒店与预订入口`
        : `已取得真实酒店结果与 ${new Set(links).size} 个可核验预订入口`,
      status: "success"
    });

    if (hotelDeal) {
      return {
        reply: `已按你的条件取得美团旅行实时酒店结果。价格、评分、图片和链接均保留接口原值。\n\n<hotel_deal>\n${JSON.stringify(hotelDeal, null, 2)}\n</hotel_deal>`
      };
    }
    return {
      reply: `已按你的条件查询美团旅行酒店实时供给。以下酒店名称、价格与链接均来自本次接口返回：\n\n${supply.content}`
    };
  } catch (error: any) {
    const code = error instanceof TicketToolError ? error.code : "UPSTREAM_ERROR";
    const detail = code === "NOT_CONFIGURED" ? "服务端尚未配置美团旅行凭证" : code === "TIMEOUT" ? "美团旅行响应超时" : "美团旅行暂时不可用";
    emitTrace(state, { id: "hotel-supply", title: "查询酒店实时供给", detail, status: "error" });
    return { reply: `${detail}。本次没有取得可核验的酒店与价格，因此不会生成预订方案。` };
  }
}
