import { StateGraph, START, END } from "@langchain/langgraph";
import { ChatGraphState } from "./state.js";
import { routerNode } from "./nodes/router.js";
import { couponNode } from "./nodes/coupon.js";
import { ticketNode } from "./nodes/ticket.js";
import { weekendNode } from "./nodes/weekend.js";
import { venueNode } from "./nodes/venue.js";
import { chatNode } from "./nodes/chat.js";
import { hotelNode } from "./nodes/hotel.js";

export function buildChatGraph() {
  const graph = new StateGraph(ChatGraphState)
    .addNode("router", routerNode)
    .addNode("coupon", couponNode)
    .addNode("ticket", ticketNode)
    .addNode("hotel", hotelNode)
    .addNode("weekend", weekendNode)
    .addNode("venue", venueNode)
    .addNode("chat", chatNode)
    .addEdge(START, "router")
    .addConditionalEdges("router", (state) => state.intent, {
      coupon: "coupon",
      ticket: "ticket",
      hotel: "hotel",
      weekend: "weekend",
      venue: "venue",
      chat: "chat",
    })
    .addEdge("coupon", END)
    .addEdge("ticket", END)
    .addEdge("hotel", END)
    .addEdge("weekend", END)
    .addEdge("venue", END)
    .addEdge("chat", END);

  return graph.compile();
}

export type ChatGraphType = ReturnType<typeof buildChatGraph>;
