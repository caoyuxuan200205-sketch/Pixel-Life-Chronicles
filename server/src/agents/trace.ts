export type TraceStatus = "running" | "success" | "warning" | "error" | "info";

export interface ExecutionTraceEvent {
  id: string;
  title: string;
  detail: string;
  status: TraceStatus;
  timestamp: number;
}

export type TraceSink = (event: ExecutionTraceEvent) => void;

export function emitTrace(
  state: { traceSink?: TraceSink },
  event: Omit<ExecutionTraceEvent, "timestamp">
) {
  state.traceSink?.({ ...event, timestamp: Date.now() });
}
