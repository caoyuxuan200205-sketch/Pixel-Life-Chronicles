import { ChatGraphState } from "../state.js";
import { emitTrace } from "../trace.js";

export async function couponNode(state: typeof ChatGraphState.State) {
  console.log(`[Coupon Node] Executing static coupon response.`);
  emitTrace(state, { id: "coupon-flow", title: "打开优惠领取流程", detail: "这里只启动授权与领取组件，不代表优惠券已领取成功", status: "info" });
  return {
    reply: "【时空福袋降临】\n\n探险者，我感受到了你对财富与好运的渴望。我为你寻得了一份美团专属大额福利！\n\n<coupon_deal>{\"action\": \"start\"}</coupon_deal>"
  };
}
