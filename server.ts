// MTI Fleet Monitor — entry point. Bun server, no framework. Stays at the
// repo root because two hosts look for it here — Vercel as the function
// entrypoint, and the LifeOS artifact host, which launches apps with
// `bun run server.ts`.
import { ON_VERCEL } from "./src/server/config";
import { handler } from "./src/server/app";

export { handler };

// Vercel's Bun runtime requires a DEFAULT export it can serve; without one every
// request 500s with "Invalid export found". But `bun run server.ts` auto-serves
// a default export too, which races the explicit Bun.serve in startup.ts and
// dies with EADDRINUSE. So the default is the handler on Vercel and undefined
// everywhere else.
export default (ON_VERCEL ? handler : undefined) as typeof handler;

if (import.meta.main && !ON_VERCEL) {
  const { startServer } = await import("./src/server/startup");
  startServer();
}
