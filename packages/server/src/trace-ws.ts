import { EventEmitter } from "node:events";
import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "node:http";
import type { Logger } from "./logger";

export interface TraceEvent {
  seq: number;
  op: string;
  [key: string]: unknown;
}

export const traceEmitter = new EventEmitter();
traceEmitter.setMaxListeners(200);

export function emitTraceEvent(invocationId: string, event: TraceEvent): void {
  traceEmitter.emit(`event:${invocationId}`, event);
}

export function emitTraceStatus(invocationId: string, status: string, coverage?: unknown): void {
  traceEmitter.emit(`status:${invocationId}`, { status, coverage });
}

export function setupTraceWs(server: Server, logger: Logger): void {
  const wss = new WebSocketServer({ noServer: true });
  const log = logger.child({ module: "trace-ws" });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const match = url.pathname.match(/^\/artifact\/ws\/trace\/(.+)$/);
    if (!match) { socket.destroy(); return; }

    wss.handleUpgrade(req, socket, head, (ws) => {
      const invocationId = match[1]!;
      log.info({ invocationId }, "WS client connected");

      const onEvent = (event: TraceEvent) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "event", data: event }));
        }
      };
      const onStatus = (data: { status: string; coverage?: unknown }) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "status", data }));
        }
      };

      traceEmitter.on(`event:${invocationId}`, onEvent);
      traceEmitter.on(`status:${invocationId}`, onStatus);

      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.ping();
      }, 30_000);

      ws.on("close", () => {
        traceEmitter.off(`event:${invocationId}`, onEvent);
        traceEmitter.off(`status:${invocationId}`, onStatus);
        clearInterval(pingInterval);
        log.info({ invocationId }, "WS client disconnected");
      });

      ws.on("error", (err) => {
        log.warn({ invocationId, err: err.message }, "WS error");
      });
    });
  });

  log.info("WebSocket trace gateway ready");
}
