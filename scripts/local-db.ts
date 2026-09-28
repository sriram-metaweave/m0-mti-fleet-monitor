/**
 * The pool factory for a LOCAL PostgreSQL (or `cloud-sql-proxy`) — same driver
 * as Vercel, @neondatabase/serverless over a WebSocket, through
 * scripts/wsproxy.ts. No tokens: the relay's auth hops do not exist here.
 * Used by scripts/local.ts and by tests/live.test.ts.
 */
import { Pool, neonConfig } from "@neondatabase/serverless";
import WebSocket from "ws";
import { usePoolFactory } from "../src/server/db";

export function useLocalDatabase(): string {
  const ws = process.env.WSPROXY_URL ?? "localhost:7777";
  neonConfig.webSocketConstructor = WebSocket as unknown as typeof globalThis.WebSocket;
  neonConfig.useSecureWebSocket = false;
  neonConfig.forceDisablePgSSL = true;
  neonConfig.pipelineConnect = false;
  neonConfig.wsProxy = (host, port) => `${ws}/v1?address=${host}:${port}`;

  usePoolFactory(async () => new Pool({
    host: process.env.PGHOST ?? "127.0.0.1",
    port: Number(process.env.PGPORT ?? 5432),
    user: process.env.PGUSER ?? process.env.USER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE ?? "nyk_mti",
    max: 4,
  }));
  return `local: ${process.env.PGDATABASE ?? "nyk_mti"} on ${process.env.PGHOST ?? "127.0.0.1"}:${process.env.PGPORT ?? 5432} via ws://${ws}`;
}
