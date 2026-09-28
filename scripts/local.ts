/**
 * Run the app against a LOCAL PostgreSQL copy of the database (or
 * `cloud-sql-proxy --port 5433`), on the same driver as Vercel.
 *
 *   bun run scripts/wsproxy.ts &      # WebSocket → TCP, port 7777
 *   PGPORT=5433 PGUSER=… PGPASSWORD=… bun run scripts/local.ts
 */
import { useLocalDatabase } from "./local-db";
import { startServer } from "../src/server/startup";

console.log(useLocalDatabase());
startServer();
