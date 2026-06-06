export interface RestaurantQueueResult {
  queueStatus: string;
  seatAvailability: string;
  fitFor: string;
}

export interface VenueTicketResult {
  ticketStatus: string;
  link: string;
}

export interface CouponResult {
  couponName: string;
  couponLink: string;
}

// 模拟网络延迟的 delay 辅助函数
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function queryRestaurantQueue(restaurantName: string): Promise<RestaurantQueueResult> {
  console.log(`[Mock Tool] queryRestaurantQueue called for: "${restaurantName}"`);
  await delay(150); // 仿真 150ms 延迟
  const currentHour = new Date().getHours();
  
  // 晚餐/午餐高峰期拥堵模拟 (11-13点, 18-20点)
  const isPeakHour = (currentHour >= 11 && currentHour <= 13) || (currentHour >= 18 && currentHour <= 20);
  
  if (isPeakHour) {
    return {
      queueStatus: "🔥 前方排队 18 桌，需等位约 40 分钟",
      seatAvailability: "无空位 (排队阻断中)",
      fitFor: "🥗 完美匹配减脂 | ⚠️ 建议选择闪送送餐到店/错峰就餐"
    };
  } else {
    return {
      queueStatus: "🟢 充足空位，无需排队",
      seatAvailability: "有靠窗景观雅座 / 充足大厅卡座",
      fitFor: "🥗 完美匹配减脂 | 👶 优选家庭儿童套餐"
    };
  }
}

export async function queryVenueTickets(venueName: string): Promise<VenueTicketResult> {
  console.log(`[Mock Tool] queryVenueTickets called for: "${venueName}"`);
  await delay(200); // 仿真 200ms 延迟
  
  const isWeekend = [0, 6].includes(new Date().getDay());
  if (isWeekend && /植物园|乐园|展览|游乐场/.test(venueName)) {
    return {
      ticketStatus: "⚠️ 今日门票已售罄（无票状况，可预约明日）",
      link: "http://dpurl.cn/ticket_standby"
    };
  }
  return {
    ticketStatus: "🎟️ 门票充足（余票 85 张，即买即入园）",
    link: "http://dpurl.cn/ticket_instant"
  };
}

export async function fetchVenueCoupons(venueName: string): Promise<CouponResult | null> {
  console.log(`[Mock Tool] fetchVenueCoupons called for: "${venueName}"`);
  await delay(100); // 仿真 100ms 延迟
  
  // 匹配特定商户的优惠信息
  if (/咖啡|猫咖/.test(venueName)) {
    return {
      couponName: "☕ 美团专享双人下午茶 8 折券",
      couponLink: "http://dpurl.cn/coupon_coffee"
    };
  }
  if (/餐|食|火锅|店/.test(venueName)) {
    return {
      couponName: "🍜 满 100 减 15 专享代金券",
      couponLink: "http://dpurl.cn/coupon_dining"
    };
  }
  return {
    couponName: "🎁 探险者专享出行小吉红包",
    couponLink: "http://dpurl.cn/coupon_general"
  };
}
