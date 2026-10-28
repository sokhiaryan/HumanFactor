// HTTP API (and, in production, the static website).
// createApp() takes its dependencies explicitly so tests can run it against an
// in-memory database without starting a server.

import cookieParser from "cookie-parser";
import express, { type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { generateCode, isValidCode, normalizeCode } from "../shared/participantCode.js";
import type { AdminQuestionKey, CreateSessionResponse, SubmitResponse } from "../shared/types.js";
import { buildAnalytics } from "./analytics.js";
import { ADMIN_COOKIE, cookieOptions, issueToken, passwordMatches, requireAdmin } from "./auth.js";
import type { Config } from "./config.js";
import * as repo from "./db.js";
import { codebookCsv, itemsCsv, responsesCsv, summaryMarkdown } from "./exports.js";
import { AnswerValidationError, validateAndScore } from "./scoring.js";
import { KNOWLEDGE_ITEMS, KNOWLEDGE_MAX, QUESTIONS } from "./survey/definition.js";
import { publicSurvey } from "./survey/public.js";

export interface AppOptions {
  db: repo.DB;
  config: Config;
  /** Directory of the built web client; served when present. */
  staticDir?: string;
  /** Disable rate limits (tests). */
  disableRateLimits?: boolean;
}

const stageSchema = z.enum(["pre", "post"]);

const createSessionSchema = z.object({
  stage: stageSchema,
  participantCode: z.string().max(32).nullish(),
});

const answerValue = z.union([
  z.string().max(64),
  z.array(z.string().max(64)).max(20),
  z.number().int().min(-1000).max(1000),
]);

const submitSchema = z.object({
  sessionId: z.string().uuid(),
  answers: z.record(z.string().max(64), answerValue).refine((a) => Object.keys(a).length <= 60, "Too many answers"),
});

const loginSchema = z.object({ password: z.string().min(1).max(256) });

function fail(res: Response, status: number, error: string, message: string, fields?: Record<string, string>) {
  res.status(status).json({ error, message, ...(fields ? { fields } : {}) });
}

export function createApp({ db, config, staticDir, disableRateLimits }: AppOptions) {
  const app = express();
  app.disable("x-powered-by");
  if (config.trustProxy) app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:"],
          fontSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: config.production ? [] : null,
        },
      },
      referrerPolicy: { policy: "no-referrer" },
    }),
  );
  app.use(express.json({ limit: "32kb" }));
  app.use(cookieParser());

  const limiter = (limit: number, opts: { skipSuccessfulRequests?: boolean } = {}) =>
    disableRateLimits
      ? (_req: Request, _res: Response, next: NextFunction) => next()
      : rateLimit({
          windowMs: 15 * 60 * 1000,
          limit,
          standardHeaders: "draft-7",
          legacyHeaders: false,
          skipSuccessfulRequests: opts.skipSuccessfulRequests,
          // Counts are kept in memory only; IP addresses are never written to the database.
          handler: (_req, res) => fail(res, 429, "rate_limited", "Too many requests. Please wait a few minutes and try again."),
        });

  const api = express.Router();
  // Participant-facing responses must never be cached by shared proxies.
  api.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  // --- Public ---------------------------------------------------------------------

  api.get("/health", (_req, res) => {
    db.prepare("SELECT 1").get();
    res.json({ ok: true });
  });

  api.get("/survey/:stage", (req, res) => {
    const stage = stageSchema.safeParse(req.params.stage);
    if (!stage.success) return fail(res, 404, "not_found", "Unknown survey stage.");
    res.json(publicSurvey(stage.data));
  });

  // Consent given → open a session. PRE issues a fresh anonymous code; POST accepts the
  // participant's code from PRE (optional) so the two responses can be paired.
  api.post("/sessions", limiter(1000), (req, res) => {
    const parsed = createSessionSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, "invalid_request", "Invalid request.");
    const { stage } = parsed.data;
    let code: string | null = null;
    let matchedPre: boolean | undefined;

    if (stage === "pre") {
      do code = generateCode((n) => randomBytes(n));
      while (repo.codeInUse(db, code));
    } else if (parsed.data.participantCode) {
      if (!isValidCode(parsed.data.participantCode)) {
        return fail(res, 400, "invalid_code", "That code doesn't look right. Check each character and try again.", {
          participantCode: "Invalid code",
        });
      }
      code = normalizeCode(parsed.data.participantCode);
      if (repo.hasResponseForCode(db, code, "post")) {
        return fail(res, 409, "already_submitted", "A follow-up response has already been recorded for this code. Thank you — there's nothing more to do.");
      }
      matchedPre = repo.hasResponseForCode(db, code, "pre");
    }

    const sessionId = randomUUID();
    repo.createSession(db, { id: sessionId, stage, participantCode: code });
    const body: CreateSessionResponse = { sessionId, stage, participantCode: code, matchedPre };
    res.status(201).json(body);
  });

  // Lets the POST flow confirm a code before opening a session. Codes are random and
  // carry no identity, so revealing whether one exists discloses nothing personal.
  api.post("/codes/check", limiter(120), (req, res) => {
    const parsed = z.object({ participantCode: z.string().max(32) }).safeParse(req.body);
    if (!parsed.success || !isValidCode(parsed.data.participantCode)) {
      return fail(res, 400, "invalid_code", "That code doesn't look right. Check each character and try again.");
    }
    const code = normalizeCode(parsed.data.participantCode);
    res.json({ preFound: repo.hasResponseForCode(db, code, "pre"), postSubmitted: repo.hasResponseForCode(db, code, "post") });
  });

  api.post("/responses", limiter(1000), (req, res) => {
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, "invalid_request", "Your answers couldn't be read. Please try again.");
    const session = repo.getSession(db, parsed.data.sessionId);
    if (!session) return fail(res, 404, "session_not_found", "This survey session has expired. Please start again.");

    // Idempotent: a retried submission for the same session returns the original result.
    if (repo.getResponseBySession(db, session.id)) {
      const body: SubmitResponse = { ok: true, stage: session.stage, participantCode: session.participant_code, alreadyRecorded: true };
      return res.status(200).json(body);
    }

    let scored;
    try {
      scored = validateAndScore(session.stage, parsed.data.answers);
    } catch (err) {
      if (err instanceof AnswerValidationError) {
        return fail(res, 422, "invalid_answers", "Some answers are missing or invalid.", err.fields);
      }
      throw err;
    }

    try {
      repo.insertResponse(db, { id: randomUUID(), session, scored, knowledgeMax: KNOWLEDGE_MAX });
    } catch (err) {
      if (err instanceof Error && /UNIQUE constraint failed: responses\.participant_code/.test(err.message)) {
        return fail(res, 409, "already_submitted", "A response has already been recorded for this code at this stage.");
      }
      throw err;
    }
    const body: SubmitResponse = { ok: true, stage: session.stage, participantCode: session.participant_code, alreadyRecorded: false };
    res.status(201).json(body);
  });

  // --- Team dashboard -----------------------------------------------------------------

  const admin = express.Router();

  // Only failed attempts count towards the limit; successful sign-ins are free.
  admin.post("/login", limiter(10, { skipSuccessfulRequests: true }), (req, res) => {
    if (!config.adminPassword) {
      return fail(res, 503, "admin_disabled", "The dashboard is disabled because ADMIN_PASSWORD is not configured.");
    }
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success || !passwordMatches(parsed.data.password, config.adminPassword)) {
      return fail(res, 401, "invalid_password", "That password isn't correct.");
    }
    res.cookie(ADMIN_COOKIE, issueToken(config.sessionSecret), cookieOptions(config.production));
    res.json({ ok: true });
  });

  admin.post("/logout", (_req, res) => {
    res.clearCookie(ADMIN_COOKIE, { ...cookieOptions(config.production), maxAge: undefined });
    res.json({ ok: true });
  });

  admin.use(requireAdmin(config.sessionSecret));

  admin.get("/me", (_req, res) => res.json({ ok: true }));

  const instance = config.demoInstance ? "demo" : "live";
  const includeDemo = (req: Request) => req.query.includeDemo === "1" || req.query.includeDemo === "true";

  admin.get("/analytics", (req, res) => {
    res.json(buildAnalytics(db, { includeDemo: includeDemo(req), instance }));
  });

  admin.get("/answer-key", (_req, res) => {
    const body: AdminQuestionKey[] = QUESTIONS.map((q) => ({
      id: q.id,
      number: q.key ? KNOWLEDGE_ITEMS.indexOf(q) + 1 : null,
      prompt: q.prompt,
      shortLabel: q.shortLabel,
      kind: q.kind,
      stages: q.stages,
      topic: q.key?.topic,
      correct: q.key?.correct ?? [],
      rationale: q.key?.rationale,
      options: (q.options ?? []).map((o) => ({
        ...o,
        isCorrect: q.key?.correct.includes(o.id) ?? false,
        misconception: q.key?.misconceptions[o.id],
      })),
    }));
    res.json(body);
  });

  // Participant withdrawal: a participant sends the team their anonymous code and a
  // team member removes every response and session stored under it.
  admin.post("/withdraw", (req, res) => {
    const parsed = z.object({ participantCode: z.string().max(32) }).safeParse(req.body);
    if (!parsed.success || !isValidCode(parsed.data.participantCode)) {
      return fail(res, 400, "invalid_code", "That isn't a valid participant code.");
    }
    res.json({ ok: true, ...repo.withdrawCode(db, normalizeCode(parsed.data.participantCode)) });
  });

  const sendFile = (res: Response, name: string, type: string, content: string) => {
    res.set("Content-Type", `${type}; charset=utf-8`);
    res.set("Content-Disposition", `attachment; filename="${name}"`);
    res.send(content);
  };
  const stamp = () => new Date().toISOString().slice(0, 10);
  const suffix = (req: Request) => `${includeDemo(req) ? "-INCLUDING-DEMO" : ""}${config.demoInstance ? "-DEMO-INSTANCE" : ""}`;

  admin.get("/export/responses.csv", (req, res) => {
    sendFile(res, `humanfactor-responses-${stamp()}${suffix(req)}.csv`, "text/csv", responsesCsv(repo.loadResponses(db, includeDemo(req))));
  });
  admin.get("/export/items.csv", (req, res) => {
    sendFile(res, `humanfactor-items-${stamp()}${suffix(req)}.csv`, "text/csv", itemsCsv(buildAnalytics(db, { includeDemo: includeDemo(req), instance })));
  });
  admin.get("/export/codebook.csv", (_req, res) => {
    sendFile(res, `humanfactor-codebook${config.demoInstance ? "-DEMO-INSTANCE" : ""}.csv`, "text/csv", codebookCsv());
  });
  admin.get("/export/summary.md", (req, res) => {
    sendFile(res, `humanfactor-summary-${stamp()}${suffix(req)}.md`, "text/markdown", summaryMarkdown(buildAnalytics(db, { includeDemo: includeDemo(req), instance })));
  });

  api.use("/admin", admin);
  api.use((_req, res) => fail(res, 404, "not_found", "Not found."));
  app.use("/api", api);

  // --- Static web client (production) ----------------------------------------------------
  if (staticDir && existsSync(staticDir)) {
    app.use(express.static(staticDir, { index: false, maxAge: "1h" }));
    // Client-side routes (/s/pre, /team, ...) all load the single-page app.
    app.use((req, res, next) => {
      if ((req.method !== "GET" && req.method !== "HEAD") || /\.[a-z0-9]+$/i.test(req.path)) return next();
      res.set("Cache-Control", "no-cache");
      res.sendFile(join(staticDir, "index.html"));
    });
  }

  // --- Errors -----------------------------------------------------------------------------
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err && typeof err === "object" && "type" in err && (err as { type: string }).type === "entity.parse.failed") {
      return fail(res, 400, "invalid_json", "Request body must be valid JSON.");
    }
    if (err && typeof err === "object" && "type" in err && (err as { type: string }).type === "entity.too.large") {
      return fail(res, 413, "too_large", "Request is too large.");
    }
    console.error("[api] unexpected error", err);
    fail(res, 500, "server_error", "Something went wrong on our side. Your answers are still saved on this device — please try again.");
  });

  return app;
}
