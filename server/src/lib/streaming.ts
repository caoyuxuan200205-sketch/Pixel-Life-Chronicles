import { CompiledGraph } from "@langchain/langgraph";
import express from "express";

export async function streamGraphToSSE(
  res: express.Response,
  graph: CompiledGraph<any, any, any, any, any, any>,
  input: any
) {
  // 1. Set SSE Headers
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // 2. Immediately send initial ping to notify reverse proxy (e.g. Vercel Edge) to open stream
  res.write('data: {"type":"ping"}\n\n');

  // 3. Heartbeat Keepalive (Every 3 seconds)
  const heartbeat = setInterval(() => {
    try {
      res.write('data: {"type":"ping"}\n\n');
    } catch (_) {}
  }, 3000);

  try {
    // 3. Stream graph events and filter for tagged generation chunks
    const stream = graph.streamEvents(input, { version: "v2" });
    let finalState: any = null;
    let chunkSentCount = 0;

    for await (const event of stream) {
      console.log(`[streamGraphToSSE] Event: ${event.event}, Name: ${event.name}`);
      if (event.event === "on_chat_model_stream") {
        const tags = event.tags || [];
        if (tags.includes("generation")) {
          const delta = event.data?.chunk?.content || "";
          if (delta) {
            res.write(`data: ${JSON.stringify({ type: "chunk", content: delta })}\n\n`);
            chunkSentCount++;
          }
        }
      } else if (event.event === "on_chain_end" && event.name === "LangGraph") {
        finalState = event.data?.output;
        console.log("[streamGraphToSSE] Captured finalState output from root chain:", JSON.stringify(finalState));
      }
    }

    clearInterval(heartbeat);

    console.log("[streamGraphToSSE] Stream loop complete. finalState:", finalState ? "Present" : "Null", "chunkSentCount:", chunkSentCount);

    const reply = finalState?.reply || "";

    // If no stream chunks were sent to the client (e.g. static couponNode, or offline/static fallbacks),
    // write the full reply as a single chunk so the UI renders the text bubble.
    if (chunkSentCount === 0 && reply) {
      res.write(`data: ${JSON.stringify({ type: "chunk", content: reply })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({
      type: "result",
      data: { success: true, reply }
    })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error: any) {
    clearInterval(heartbeat);
    console.error("[streamGraphToSSE] Error during LangGraph run:", error);
    try {
      res.write(`data: ${JSON.stringify({
        type: "error",
        message: error.message || "AI 调用失败"
      })}\n\n`);
      res.end();
    } catch (_) {
      if (!res.headersSent) {
        res.status(500).json({ error: error.message || "内部服务异常" });
      }
    }
  }
}
