// Integration tests: the real Express app + real SQLite (in-memory or temp file).
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isValidCode } from "../shared/participantCode.js";
import type { AnalyticsReport, PublicSurvey, Stage } from "../shared/types.js";
import { createApp } from "../server/app.js";
import { issueToken, verifyToken } from "../server/auth.js";
import { createSession, getSession, insertResponse, openDatabase, type DB } from "../server/db.js";
import { validateAndScore } from "../server/scoring.js";
import { KNOWLEDGE_MAX } from "../server/survey/definition.js";
import { ADMIN_PASSWORD, makeAnswers, testConfig } from "./helpers.js";

let db: DB;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  db = openDatabase(":memory:");
  app = createApp({ db, config: testConfig(), disableRateLimits: true });
});
afterEach(() => db.close());

async function login(agent = request.agent(app)) {
  await agent.post("/api/admin/login").send({ password: ADMIN_PASSWORD }).expect(200);
  return agent;
}

async function complete(stage: Stage, correct: number, participantCode: string | null = null) {
  const s = await request(app).post("/api/sessions").send({ stage, participantCode }).expect(201);
  await request(app).post("/api/responses").send({ sessionId: s.body.sessionId, answers: makeAnswers(stage, correct) }).expect(201);
  return s.body as { sessionId: string; participantCode: string | null; matchedPre?: boolean };
}

describe("public survey", () => {
  it("serves PRE and POST definitions without any answer-key data", async () => {
    for (const [stage, count] of [
      ["pre", 15],
      ["post", 13],
    ] as const) {
      const res = await request(app).get(`/api/survey/${stage}`).expect(200);
      const body = res.body as PublicSurvey;
      expect(body.stage).toBe(stage);
      expect(body.questions).toHaveLength(count);
      const json = JSON.stringify(body);
      for (const leak of ['"key"', "correct", "misconception", "rationale", "shortLabel"]) expect(json).not.toContain(leak);
    }
    expect((await request(app).get("/api/survey/pre")).body.questions.filter((q: { section: string }) => q.section === "about")).toHaveLength(3);
    expect((await request(app).get("/api/survey/post")).body.questions.some((q: { id: string }) => q.id === "r_exposure")).toBe(true);
  });

  it("404s an unknown stage", async () => {
    await request(app).get("/api/survey/during").expect(404);
  });

  it("sets security headers", async () => {
    const res = await request(app).get("/api/survey/pre");
    expect(res.headers["content-security-policy"]).toContain("default-src 'self'");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["cache-control"]).toBe("no-store");
  });
});

describe("sessions and submissions", () => {
  it("issues a valid anonymous code for PRE and stores the scored response", async () => {
    const s = await complete("pre", 7);
    expect(isValidCode(s.participantCode!)).toBe(true);
    const row = db.prepare("SELECT * FROM responses").get() as Record<string, unknown>;
    expect(row).toMatchObject({ stage: "pre", participant_code: s.participantCode, knowledge_score: 7, knowledge_max: 10, is_demo: 0 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM answers").get()).toEqual({ n: 12 }); // 1 + 10 + 1 (demographics skipped)
    expect(getSession(db, s.sessionId)!.completed_at).not.toBeNull();
  });

  it("never returns the score to the participant", async () => {
    const s = await request(app).post("/api/sessions").send({ stage: "pre" });
    const res = await request(app).post("/api/responses").send({ sessionId: s.body.sessionId, answers: makeAnswers("pre", 4) });
    expect(Object.keys(res.body).sort()).toEqual(["alreadyRecorded", "ok", "participantCode", "stage"]);
  });

  it("is idempotent for retried submissions", async () => {
    const s = await request(app).post("/api/sessions").send({ stage: "pre" });
    const payload = { sessionId: s.body.sessionId, answers: makeAnswers("pre", 5) };
    await request(app).post("/api/responses").send(payload).expect(201);
    const again = await request(app).post("/api/responses").send(payload).expect(200);
    expect(again.body.alreadyRecorded).toBe(true);
    expect(db.prepare("SELECT COUNT(*) AS n FROM responses").get()).toEqual({ n: 1 });
  });

  it("rejects incomplete answers with per-question errors and stores nothing", async () => {
    const s = await request(app).post("/api/sessions").send({ stage: "pre" });
    const answers = makeAnswers("pre");
    delete answers.k03_padlock;
    const res = await request(app).post("/api/responses").send({ sessionId: s.body.sessionId, answers }).expect(422);
    expect(res.body.fields).toHaveProperty("k03_padlock");
    expect(db.prepare("SELECT COUNT(*) AS n FROM responses").get()).toEqual({ n: 0 });
  });

  it("rejects malformed requests", async () => {
    await request(app).post("/api/sessions").send({ stage: "middle" }).expect(400);
    await request(app).post("/api/responses").send({ sessionId: "not-a-uuid", answers: {} }).expect(400);
    await request(app).post("/api/responses").send({ sessionId: crypto.randomUUID(), answers: {} }).expect(404);
    await request(app).post("/api/responses").set("Content-Type", "application/json").send("{bad json").expect(400);
    await request(app).post("/api/responses").send({ sessionId: crypto.randomUUID(), answers: { x: "y".repeat(40000) } }).expect(413);
  });

  it("stores SQL-looking input as inert data", async () => {
    const s = await request(app).post("/api/sessions").send({ stage: "pre" });
    const res = await request(app)
      .post("/api/responses")
      .send({ sessionId: s.body.sessionId, answers: makeAnswers("pre", 10, { "x'); DROP TABLE responses;--": "a" }) })
      .expect(422);
    expect(res.body.fields).toHaveProperty("x'); DROP TABLE responses;--");
    expect(db.prepare("SELECT COUNT(*) AS n FROM sessions").get()).toEqual({ n: 1 });
  });
});

describe("PRE/POST matching", () => {
  it("matches POST to PRE by anonymous code and blocks duplicate POSTs", async () => {
    const pre = await complete("pre", 4);
    const check = await request(app).post("/api/codes/check").send({ participantCode: pre.participantCode }).expect(200);
    expect(check.body).toEqual({ preFound: true, postSubmitted: false });

    const post = await complete("post", 8, pre.participantCode!.toLowerCase());
    expect(post.matchedPre).toBe(true);

    await request(app).post("/api/sessions").send({ stage: "post", participantCode: pre.participantCode }).expect(409);
    expect((await request(app).post("/api/codes/check").send({ participantCode: pre.participantCode })).body.postSubmitted).toBe(true);
  });

  it("blocks a second POST submitted through a parallel session", async () => {
    const pre = await complete("pre", 4);
    const a = await request(app).post("/api/sessions").send({ stage: "post", participantCode: pre.participantCode });
    const b = await request(app).post("/api/sessions").send({ stage: "post", participantCode: pre.participantCode });
    await request(app).post("/api/responses").send({ sessionId: a.body.sessionId, answers: makeAnswers("post", 6) }).expect(201);
    await request(app).post("/api/responses").send({ sessionId: b.body.sessionId, answers: makeAnswers("post", 6) }).expect(409);
  });

  it("rejects mistyped codes and allows POST without a code", async () => {
    await request(app).post("/api/sessions").send({ stage: "post", participantCode: "ABCD-EFGH" }).expect(400);
    await request(app).post("/api/codes/check").send({ participantCode: "nope" }).expect(400);
    const post = await complete("post", 5, null);
    expect(post.participantCode).toBeNull();
  });

  it("ignores client-supplied codes at PRE (server always issues a fresh one)", async () => {
    const pre1 = await complete("pre", 4);
    const s = await request(app).post("/api/sessions").send({ stage: "pre", participantCode: pre1.participantCode }).expect(201);
    expect(s.body.participantCode).not.toBe(pre1.participantCode);
  });
});

describe("dashboard authorization", () => {
  const protectedGets = [
    "/api/admin/me",
    "/api/admin/analytics",
    "/api/admin/answer-key",
    "/api/admin/export/responses.csv",
    "/api/admin/export/items.csv",
    "/api/admin/export/codebook.csv",
    "/api/admin/export/summary.md",
  ];

  it("rejects every admin endpoint without a session", async () => {
    for (const path of protectedGets) await request(app).get(path).expect(401);
    await request(app).post("/api/admin/withdraw").send({ participantCode: "x" }).expect(401);
  });

  it("rejects wrong passwords and forged or expired tokens", async () => {
    await request(app).post("/api/admin/login").send({ password: "wrong" }).expect(401);
    await request(app).get("/api/admin/analytics").set("Cookie", "hlac_admin=eyJleHAiOjk5OTk5OTk5OTk5OTl9.forged").expect(401);
    const otherSecret = issueToken("y".repeat(64));
    await request(app).get("/api/admin/analytics").set("Cookie", `hlac_admin=${otherSecret}`).expect(401);
    const expired = issueToken("x".repeat(64), Date.now() - 9 * 60 * 60 * 1000);
    expect(verifyToken(expired, "x".repeat(64))).toBe(false);
    await request(app).get("/api/admin/analytics").set("Cookie", `hlac_admin=${expired}`).expect(401);
  });

  it("issues an HttpOnly, SameSite=Strict cookie scoped to the admin API", async () => {
    const res = await request(app).post("/api/admin/login").send({ password: ADMIN_PASSWORD }).expect(200);
    const cookie = String(res.headers["set-cookie"]);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Path=/api/admin");
  });

  it("allows access after login and denies it after logout", async () => {
    const agent = await login();
    for (const path of protectedGets) await agent.get(path).expect(200);
    await agent.post("/api/admin/logout").expect(200);
    await agent.get("/api/admin/analytics").expect(401);
  });

  it("disables the login when no admin password is configured", async () => {
    const noAdmin = createApp({ db, config: testConfig({ adminPassword: null }), disableRateLimits: true });
    await request(noAdmin).post("/api/admin/login").send({ password: "anything" }).expect(503);
  });

  it("rate-limits login attempts", async () => {
    const limited = createApp({ db, config: testConfig() });
    for (let i = 0; i < 10; i++) await request(limited).post("/api/admin/login").send({ password: "wrong" }).expect(401);
    await request(limited).post("/api/admin/login").send({ password: ADMIN_PASSWORD }).expect(429);
  });
});

describe("analytics", () => {
  it("reflects stored responses, pairs and item accuracy", async () => {
    const a = await complete("pre", 4);
    const b = await complete("pre", 6);
    await complete("pre", 2); // never returns
    await complete("post", 7, a.participantCode);
    await complete("post", 6, b.participantCode);
    await complete("post", 10, null); // unmatched
    await request(app).post("/api/sessions").send({ stage: "pre" }); // abandoned

    const r = (await (await login()).get("/api/admin/analytics").expect(200)).body as AnalyticsReport;
    expect(r.overview.totalResponses).toBe(6);
    expect(r.overview.byStage.pre).toMatchObject({ started: 4, completed: 3, abandoned: 1, completionRate: 0.75 });
    expect(r.overview.byStage.post).toMatchObject({ started: 3, completed: 3 });
    expect(r.overview.matchedPairs).toBe(2);
    expect(r.overview.unmatchedPost).toBe(1);

    expect(r.scores.pre.mean).toBeCloseTo(4);
    expect(r.scores.post.mean).toBeCloseTo(23 / 3);
    expect(r.scores.pre.histogram.find((h) => h.bin === 4)?.count).toBe(1);

    const p = r.comparison.paired;
    expect(p.n).toBe(2);
    expect(p.meanPre).toBe(5);
    expect(p.meanPost).toBe(6.5);
    expect(p.meanChange).toBe(1.5);
    expect(p.improved).toBe(1);
    expect(p.unchanged).toBe(1);
    expect(p.tTest).toBeNull(); // too few pairs for a test
    expect(p.pairs).toEqual([
      { pre: 4, post: 7 },
      { pre: 6, post: 6 },
    ]);

    // Item 1 is correct for every response; item 10 only for the 10/10 POST.
    expect(r.items[0].byStage.pre.accuracy).toBe(1);
    expect(r.items[9].byStage.post.accuracy).toBeCloseTo(1 / 3);
    // Item 5: pre correct for b only (6 correct); post correct for a (7) and b (6)
    expect(r.items[4].paired).toMatchObject({ improved: 1, stayedCorrect: 1, declined: 0 });
    expect(r.items[0].change.direction).toBe("insufficient"); // fewer than 5 per stage

    expect(r.selfAssessment.pre.confidenceMean).toBe(3);
    expect(r.selfAssessment.pre.calibrationMean).toBeCloseTo(7 - 4);
    expect(r.dataQuality.warnings.some((w) => w.includes("below the 30-participant"))).toBe(true);
    expect(r.caveats.length).toBeGreaterThan(0);
    expect(r.exposure.postScoreByExposure.find((g) => g.group === "exposed")?.n).toBe(3);
  });

  it("excludes demonstration data unless explicitly requested", async () => {
    await complete("pre", 5);
    const id = crypto.randomUUID();
    createSession(db, { id, stage: "pre", participantCode: null, isDemo: true });
    insertResponse(db, { id: crypto.randomUUID(), session: getSession(db, id)!, scored: validateAndScore("pre", makeAnswers("pre", 9)), knowledgeMax: KNOWLEDGE_MAX });

    const agent = await login();
    const real = (await agent.get("/api/admin/analytics")).body as AnalyticsReport;
    expect(real.overview.totalResponses).toBe(1);
    expect(real.includesDemo).toBe(false);
    expect(real.demoResponsesInDatabase).toBe(1);
    const withDemo = (await agent.get("/api/admin/analytics?includeDemo=1")).body as AnalyticsReport;
    expect(withDemo.overview.totalResponses).toBe(2);
    expect(withDemo.dataQuality.warnings[0]).toMatch(/Demonstration data/);

    const csv = (await agent.get("/api/admin/export/responses.csv")).text;
    expect(csv.trim().split("\r\n")).toHaveLength(2);
    expect((await agent.get("/api/admin/export/responses.csv?includeDemo=1")).headers["content-disposition"]).toContain("INCLUDING-DEMO");
  });
});

describe("exports", () => {
  it("produces response-level CSV with the intended fields", async () => {
    const pre = await complete("pre", 6);
    await complete("post", 9, pre.participantCode);
    const agent = await login();
    const res = await agent.get("/api/admin/export/responses.csv").expect(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toMatch(/attachment; filename="hlac-responses-\d{4}-\d{2}-\d{2}\.csv"/);
    const [header, ...rows] = res.text.trim().split("\r\n").map((l) => l.split(","));
    for (const col of [
      "response_id",
      "stage",
      "participant_code",
      "matched_pre_post",
      "submitted_at",
      "duration_seconds",
      "knowledge_score",
      "knowledge_pct",
      "confidence_1to5",
      "estimated_correct",
      "is_demo",
      "d_year",
      "k01_account_email",
      "k01_account_email__score",
      "k04_warning_signs",
      "r_exposure",
    ]) {
      expect(header).toContain(col);
    }
    expect(rows).toHaveLength(2);
    const get = (row: string[], col: string) => row[header.indexOf(col)];
    expect(rows.map((r) => get(r, "knowledge_score"))).toEqual(["6", "9"]);
    expect(rows.every((r) => get(r, "matched_pre_post") === "true")).toBe(true);
    expect(get(rows[0], "k04_warning_signs")).toBe("attachment;credentials;mismatch;urgency");
  });

  it("produces item, codebook and summary exports", async () => {
    await complete("pre", 6);
    const agent = await login();
    const items = (await agent.get("/api/admin/export/items.csv")).text.trim().split("\r\n");
    expect(items).toHaveLength(11);
    expect(items[0]).toContain("mcnemar_p");
    const codebook = (await agent.get("/api/admin/export/codebook.csv")).text;
    expect(codebook).toContain("k02_real_url,pre+post,single,true");
    const md = (await agent.get("/api/admin/export/summary.md")).text;
    expect(md).toContain("## Knowledge scores");
    expect(md).toContain("not its cause");
  });
});

describe("withdrawal", () => {
  it("deletes all data stored under a code", async () => {
    const pre = await complete("pre", 6);
    await complete("post", 9, pre.participantCode);
    await complete("pre", 3);
    const agent = await login();
    const res = await agent.post("/api/admin/withdraw").send({ participantCode: pre.participantCode }).expect(200);
    expect(res.body).toMatchObject({ responses: 2, sessions: 2 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM responses").get()).toEqual({ n: 1 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM answers").get()).toEqual({ n: 12 });
  });
});

describe("persistence", () => {
  it("keeps responses after the server restarts", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hlac-"));
    const file = join(dir, "test.db");
    try {
      let fileDb = openDatabase(file);
      let fileApp = createApp({ db: fileDb, config: testConfig({ databasePath: file }), disableRateLimits: true });
      const s = await request(fileApp).post("/api/sessions").send({ stage: "pre" });
      await request(fileApp).post("/api/responses").send({ sessionId: s.body.sessionId, answers: makeAnswers("pre", 8) }).expect(201);
      fileDb.close();

      fileDb = openDatabase(file); // "restart": new connection, migrations re-run safely
      fileApp = createApp({ db: fileDb, config: testConfig({ databasePath: file }), disableRateLimits: true });
      const agent = request.agent(fileApp);
      await agent.post("/api/admin/login").send({ password: ADMIN_PASSWORD }).expect(200);
      const r = (await agent.get("/api/admin/analytics")).body as AnalyticsReport;
      expect(r.overview.totalResponses).toBe(1);
      expect(r.scores.pre.mean).toBe(8);
      expect(fileDb.prepare("SELECT COUNT(*) AS n FROM schema_migrations").get()).toEqual({ n: 1 });
      fileDb.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("static web client", () => {
  it("serves the built app for client-side routes but keeps /api JSON-only", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hlac-web-"));
    try {
      writeFileSync(join(dir, "index.html"), "<!doctype html><title>app</title>");
      const web = createApp({ db, config: testConfig(), staticDir: dir, disableRateLimits: true });
      for (const path of ["/", "/s/pre", "/s/post", "/team", "/team/anything"]) {
        const res = await request(web).get(path).expect(200);
        expect(res.text).toContain("<title>app</title>");
      }
      await request(web).get("/assets/missing.js").expect(404);
      const missing = await request(web).get("/api/does-not-exist").expect(404);
      expect(missing.body.error).toBe("not_found");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
