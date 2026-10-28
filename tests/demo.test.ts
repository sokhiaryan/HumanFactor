import request from "supertest";
import { describe, expect, it } from "vitest";
import type { AnalyticsReport } from "../shared/types.js";
import { buildAnalytics } from "../server/analytics.js";
import { createApp } from "../server/app.js";
import { openDatabase } from "../server/db.js";
import { checkDemoTarget, demoTargetFromEnv, DemoTargetError, generateDemoData } from "../server/demo/generate.js";
import { verifyAnalytics } from "../server/demo/verify.js";
import { ADMIN_PASSWORD, testConfig } from "./helpers.js";

const NOW = Date.parse("2026-10-28T12:00:00Z");

function demoDb(seed = 7, preN = 40) {
  const db = openDatabase(":memory:");
  generateDemoData(db, { seed, preN, now: NOW });
  return db;
}

describe("synthetic demonstration data", () => {
  it("produces analytics that match an independent recomputation from raw SQL", () => {
    const db = demoDb();
    const { checks, ok } = verifyAnalytics(db);
    expect(checks.filter((c) => !c.ok)).toEqual([]);
    expect(ok).toBe(true);
    expect(checks.length).toBeGreaterThan(100);
    db.close();
  });

  it("is stored exactly like real responses (no demo flag, backdated timestamps)", () => {
    const db = demoDb();
    expect(db.prepare("SELECT COUNT(*) AS n FROM responses WHERE is_demo = 1").get()).toEqual({ n: 0 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE is_demo = 1").get()).toEqual({ n: 0 });
    const { latest } = db.prepare("SELECT MAX(submitted_at) AS latest FROM responses").get() as { latest: string };
    expect(Date.parse(latest)).toBeLessThan(NOW);
    db.close();
  });

  it("has realistic properties", () => {
    const db = demoDb();
    const r = buildAnalytics(db, { includeDemo: false });
    expect(r.overview.byStage.pre.abandoned).toBeGreaterThan(0);
    expect(r.overview.unmatchedPost).toBeGreaterThan(0);
    const preAcc = r.items.map((i) => i.byStage.pre.accuracy!);
    expect(Math.max(...preAcc) - Math.min(...preAcc)).toBeGreaterThanOrEqual(0.3);
    expect(r.comparison.paired.meanChange!).toBeGreaterThan(0.3);
    expect(r.comparison.paired.meanChange!).toBeLessThan(2.5);
    expect(r.comparison.paired.declined).toBeGreaterThan(0); // not everyone improves
    expect(r.selfAssessment.pre.calibrationMean!).toBeGreaterThan(0);
    expect(r.demographics.some((d) => d.skipped > 0)).toBe(true);
    db.close();
  });

  it("is deterministic for a given seed", () => {
    const scores = (seed: number) => {
      const db = demoDb(seed);
      const s = (db.prepare("SELECT knowledge_score AS s FROM responses ORDER BY submitted_at, id").all() as { s: number }[]).map((x) => x.s);
      db.close();
      return s;
    };
    expect(scores(11)).toEqual(scores(11));
    expect(scores(11)).not.toEqual(scores(12));
  });

  it("refuses to write into the live database", () => {
    expect(() => checkDemoTarget("./data/hlac.db", "./data/hlac.db")).toThrow(DemoTargetError);
    expect(() => checkDemoTarget("data/../data/hlac.db", "./data/hlac.db")).toThrow(DemoTargetError);
    expect(() => checkDemoTarget("./data/demo.db", "./data/hlac.db")).not.toThrow();
    expect(demoTargetFromEnv({})).toEqual({ target: "./data/demo.db", livePath: "./data/hlac.db" });
    expect(demoTargetFromEnv({ DEMO_DATABASE_PATH: "/x/demo.db", DATABASE_PATH: "/x/live.db" })).toEqual({
      target: "/x/demo.db",
      livePath: "/x/live.db",
    });
  });

  it("labels a demo instance in analytics and exports", async () => {
    const db = demoDb();
    const app = createApp({ db, config: testConfig({ demoInstance: true }), disableRateLimits: true });
    const agent = request.agent(app);
    await agent.post("/api/admin/login").send({ password: ADMIN_PASSWORD }).expect(200);
    const r = (await agent.get("/api/admin/analytics")).body as AnalyticsReport;
    expect(r.instance).toBe("demo");
    expect(verifyAnalytics(db, r).ok).toBe(true); // the served report, not just the in-process one
    const csv = await agent.get("/api/admin/export/responses.csv");
    expect(csv.headers["content-disposition"]).toContain("-DEMO-INSTANCE");
    const md = (await agent.get("/api/admin/export/summary.md")).text;
    expect(md).toContain("Synthetic demonstration dataset");

    const live = createApp({ db, config: testConfig(), disableRateLimits: true });
    const liveAgent = request.agent(live);
    await liveAgent.post("/api/admin/login").send({ password: ADMIN_PASSWORD }).expect(200);
    expect(((await liveAgent.get("/api/admin/analytics")).body as AnalyticsReport).instance).toBe("live");
    db.close();
  });
});
