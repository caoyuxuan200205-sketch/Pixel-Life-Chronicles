import { Annotation } from "@langchain/langgraph";

export interface Message {
  role: string;
  content: string;
}

export interface VenueLink {
  tenantName: string;
  link: string;
}

export interface TicketParams {
  city: string;
  query: string;
}

export const ChatGraphState = Annotation.Root({
  // Inputs from client request
  messages: Annotation<Message[]>({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),
  username: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "探索者",
  }),
  city: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "杭州",
  }),
  luckyElement: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "金",
  }),
  venueLinks: Annotation<VenueLink[]>({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),
  boundMembers: Annotation<any[]>({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),

  // Middle/Transitional States
  intent: Annotation<"coupon" | "ticket" | "weekend" | "venue" | "chat">({
    reducer: (x, y) => y ?? x,
    default: () => "chat",
  }),
  ticketData: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),
  ticketParams: Annotation<TicketParams>({
    reducer: (x, y) => y ?? x,
    default: () => ({ city: "杭州", query: "" }),
  }),

  // Outputs
  reply: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),
});
