import { StateGraph, START, END } from "@langchain/langgraph";
import { ChatGraphState } from "./state";
import { routerNode } from "./nodes/router";
import { couponNode } from "./nodes/coupon";
import { ticketNode } from "./nodes/ticket";
import { weekendNode } from "./nodes/weekend";
import { venueNode } from "./nodes/venue";
import { chatNode } from "./nodes/chat";

export function buildChatGraph() {
  const graph = new StateGraph(ChatGraphState)
    .addNode("router", routerNode)
    .addNode("coupon", couponNode)
    .addNode("ticket", ticketNode)
    .addNode("weekend", weekendNode)
    .addNode("venue", venueNode)
    .addNode("chat", chatNode)
    .addEdge(START, "router")
    .addConditionalEdges("router", (state) => state.intent, {
      coupon: "coupon",
      ticket: "ticket",
      weekend: "weekend",
      venue: "venue",
      chat: "chat",
    })
    .addEdge("coupon", END)
    .addEdge("ticket", END)
    .addEdge("weekend", END)
    .addEdge("venue", END)
    .addEdge("chat", END);

  return graph.compile();
}

export type ChatGraphType = ReturnType<typeof buildChatGraph>;
