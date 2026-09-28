/**
 * The database seam — no Postgres needed. A fake pool stands in for the relay
 * so the tests can see when a pool is opened, what text reaches it, and that
 * it is always released.
 */
import { describe, expect, test, beforeEach } from "bun:test";
import type { Pool } from "@neondatabase/serverless";
import { sql, withDatabase, usePoolFactory, describe as describeDb } from "../src/server/db";
import { handler } from "../src/server/app";

type Call = { text: string; params: unknown[] };
let opened = 0, ended = 0, calls: Call[] = [];

function fakePool(rows: unknown[] = []): Pool {
  opened++;
  return {
    query: async (text: string, params: unknown[]) => { calls.push({ text, params }); return { rows }; },
    end: async () => { ended++; },
  } as unknown as Pool;
}

beforeEach(() => {
  opened = 0; ended = 0; calls = [];
  usePoolFactory(async () => fakePool([{ ok: 1 }]));
});

describe("sql tagged template", () => {
  test("values become $1…$n, in order", () => {
    const { text, params } = sql`SELECT * FROM t WHERE a = ${1} AND b = ${"x"}`.compile();
    expect(text).toBe("SELECT * FROM t WHERE a = $1 AND b = $2");
    expect(params).toEqual([1, "x"]);
  });
  test("nested fragments fold in and keep numbering across them", () => {
    const slug = "eums";
    const frag = sql`AND domain_slug = ${slug}`;
    const { text, params } = sql`SELECT 1 WHERE imo = ${"9531739"} ${frag} AND n > ${5}`.compile();
    expect(text).toBe("SELECT 1 WHERE imo = $1 AND domain_slug = $2 AND n > $3");
    expect(params).toEqual(["9531739", "eums", 5]);
  });
  test("an empty fragment adds nothing", () => {
    const { text, params } = sql`SELECT 1 ${sql``}WHERE x = ${2}`.compile();
    expect(text).toBe("SELECT 1 WHERE x = $1");
    expect(params).toEqual([2]);
  });
  test("an array is one parameter (for = ANY($n))", () => {
    const { text, params } = sql`WHERE tag_id = ANY(${["a", "b"]})`.compile();
    expect(text).toBe("WHERE tag_id = ANY($1)");
    expect(params).toEqual([["a", "b"]]);
  });
});

describe("withDatabase", () => {
  test("a query outside withDatabase is refused", async () => {
    await expect(Promise.resolve(sql`SELECT 1`)).rejects.toThrow("outside withDatabase");
  });
  test("no query → no pool opened", async () => {
    await withDatabase(async () => 1);
    expect(opened).toBe(0);
  });
  test("one pool per unit of work, shared by its queries, always ended", async () => {
    const rows = await withDatabase(async () => { await sql`SELECT 1`; return sql`SELECT ${2}`; });
    expect(rows).toEqual([{ ok: 1 }]);
    expect(opened).toBe(1);
    expect(ended).toBe(1);
    expect(calls.map((c) => c.text)).toEqual(["SELECT 1", "SELECT $1"]);
  });
  test("the pool is ended even when the work throws", async () => {
    await expect(withDatabase(async () => { await sql`SELECT 1`; throw new Error("boom"); })).rejects.toThrow("boom");
    expect(ended).toBe(1);
  });
});

describe("handler", () => {
  test("/api/health opens no pool and mints no token", async () => {
    const r = await handler.fetch(new Request("http://127.0.0.1/api/health"));
    expect(r.status).toBe(200);
    expect(opened).toBe(0);
  });
  test("a data route runs inside withDatabase and releases its pool", async () => {
    usePoolFactory(async () => fakePool([]));
    const r = await handler.fetch(new Request("http://127.0.0.1/api/vessel/no-such-vessel"));
    expect(r.status).toBe(404);
    expect(opened).toBe(1);
    expect(ended).toBe(1);
  });
});

describe("describe()", () => {
  test("empty when the environment names no relay", () => {
    const saved = process.env.PG_RELAY_URL;
    delete process.env.PG_RELAY_URL;
    try { expect(describeDb()).toBe(""); } finally { if (saved) process.env.PG_RELAY_URL = saved; }
  });
  test("the database comes from DB_NAME when PGDATABASE is unset (the GCP handover's name)", () => {
    const keys = ["PG_RELAY_URL", "PGDATABASE", "DB_NAME", "GCP_PROJECT_NUMBER", "GCP_SERVICE_ACCOUNT_EMAIL",
      "GCP_WORKLOAD_IDENTITY_POOL_ID", "GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID"] as const;
    const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
    Object.assign(process.env, {
      PG_RELAY_URL: "https://relay.example", DB_NAME: "nyk_mti", GCP_PROJECT_NUMBER: "1",
      GCP_SERVICE_ACCOUNT_EMAIL: "sa@p.iam.gserviceaccount.com", GCP_WORKLOAD_IDENTITY_POOL_ID: "v", GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID: "v",
    });
    delete process.env.PGDATABASE;
    try { expect(describeDb()).toContain("→ nyk_mti as sa@p.iam.gserviceaccount.com"); }
    finally { for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } }
  });
});
