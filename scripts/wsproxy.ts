/**
 * WebSocket → TCP bridge for local runs — the local stand-in for pg-relay.
 * @neondatabase/serverless opens ws://<this>/v1?address=host:port and speaks
 * the Postgres wire protocol in binary frames; this pipes them to that TCP
 * address. Loopback only, no auth: never expose it.
 *
 *   bun run scripts/wsproxy.ts        # WSPROXY_PORT, default 7777
 */
import type { Socket } from "bun";

type Link = { address: string; tcp?: Socket; queue: Uint8Array[] };
const port = Number(process.env.WSPROXY_PORT ?? 7777);

Bun.serve<Link, never>({
  hostname: "127.0.0.1",
  port,
  fetch(req, server) {
    const address = new URL(req.url).searchParams.get("address") ?? "";
    if (!/^[\w.-]+:\d+$/.test(address)) return new Response("address=host:port required", { status: 400 });
    return server.upgrade(req, { data: { address, queue: [] } }) ? undefined : new Response("upgrade failed", { status: 400 });
  },
  websocket: {
    async open(ws) {
      const [hostname, p] = ws.data.address.split(":");
      try {
        ws.data.tcp = await Bun.connect({
          hostname: hostname!, port: Number(p),
          socket: {
            data: (_s, chunk) => { ws.sendBinary(chunk); },
            close: () => ws.close(),
            error: () => ws.close(),
          },
        });
        for (const q of ws.data.queue) ws.data.tcp.write(q);
        ws.data.queue = [];
      } catch (e) {
        console.error(`[wsproxy] ${ws.data.address}:`, (e as Error).message);
        ws.close();
      }
    },
    message(ws, msg) {
      const bytes = typeof msg === "string" ? new TextEncoder().encode(msg) : new Uint8Array(msg);
      if (ws.data.tcp) ws.data.tcp.write(bytes); else ws.data.queue.push(bytes);
    },
    close(ws) { ws.data.tcp?.end(); },
  },
});
console.log(`wsproxy: ws://127.0.0.1:${port}/v1?address=host:port → tcp`);
