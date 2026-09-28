/**
 * Binding the port and saying what was found.
 */
import { sql, withDatabase, describe } from "./db";
import { APP_DIR, port } from "./config";
import { handler } from "./app";

export function startServer(): void {
  let served: ReturnType<typeof Bun.serve>;
  try {
    served = Bun.serve({ ...handler, hostname: "127.0.0.1" });
  } catch (err) {
    if ((err as { code?: string })?.code !== "EADDRINUSE") throw err;
    console.error(
      `\n  ✖  port ${port} is already in use.\n` +
      "     The host assigned this port and proxies to it; starting on another\n" +
      "     would answer 503 through the control plane. Stop what holds it.\n",
    );
    process.exit(1);
  }

  console.log(`mti-fleet-monitor listening on ${served.port}`);
  console.log(`app dir: ${APP_DIR}`);
  console.log(describe() || "db: PG_RELAY_URL is not set — every read will fail (see .env.example)");
  console.log("auth: none — everyone who reaches this port reads this business");
  void sayWhatWasFound();
}

async function sayWhatWasFound(): Promise<void> {
  try {
    await withDatabase(async () => {
      const doms = (await sql`SELECT slug, label FROM living_office.domain ORDER BY created_at`) as { slug: string; label: string }[];
      const [c] = (await sql`
        SELECT count(DISTINCT n.attrs->>'check_file_id')::int AS analysed, (SELECT count(*) FROM m0_check_reports.check_raw)::int AS total,
               (SELECT count(*) FROM living_office.entity)::int AS vessels
        FROM living_office.dossier d JOIN living_office.note n ON n.dossier_id = d.id AND n.type = 'report'`) as { analysed: number; total: number; vessels: number }[];
      console.log(`data: ${doms.map((d) => `${d.slug} (${d.label})`).join(", ") || "no domain"} · ` +
        `${c?.vessels ?? 0} vessels · ${c?.analysed ?? 0} of ${c?.total ?? 0} checks analysed`);
    });
  } catch (e) {
    console.error("[startup] could not read the database:", (e as Error).message);
  }
}
