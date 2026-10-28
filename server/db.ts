// SQLite persistence: connection, versioned migrations and data-access helpers.
// Every query is a prepared statement with bound parameters (no string-built SQL).

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { AnswerValue, Stage } from "../shared/types.js";
import type { Outcome, ScoredResponse } from "./scoring.js";
import { QUESTIONS, SURVEY_VERSION } from "./survey/definition.js";

export type DB = Database.Database;

const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE survey_versions (
        version         TEXT PRIMARY KEY,
        definition_json TEXT NOT NULL,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL
      );

      -- A session is created when a participant gives consent; it lets us measure
      -- completion rates and makes submission idempotent (one response per session).
      CREATE TABLE sessions (
        id               TEXT PRIMARY KEY,
        stage            TEXT NOT NULL CHECK (stage IN ('pre', 'post')),
        participant_code TEXT,
        survey_version   TEXT NOT NULL,
        started_at       TEXT NOT NULL,
        completed_at     TEXT,
        is_demo          INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1))
      );
      CREATE INDEX sessions_stage ON sessions (stage, is_demo);

      CREATE TABLE responses (
        id                TEXT PRIMARY KEY,
        session_id        TEXT NOT NULL UNIQUE REFERENCES sessions (id),
        stage             TEXT NOT NULL CHECK (stage IN ('pre', 'post')),
        participant_code  TEXT,
        survey_version    TEXT NOT NULL,
        submitted_at      TEXT NOT NULL,
        duration_seconds  INTEGER,
        knowledge_score   REAL NOT NULL,
        knowledge_max     REAL NOT NULL,
        fully_correct     INTEGER NOT NULL,
        confidence        INTEGER,
        estimated_correct INTEGER,
        is_demo           INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
        -- One response per anonymous code per stage (NULL codes are not constrained).
        UNIQUE (participant_code, stage)
      );
      CREATE INDEX responses_stage ON responses (stage, is_demo);

      CREATE TABLE answers (
        response_id TEXT NOT NULL REFERENCES responses (id) ON DELETE CASCADE,
        question_id TEXT NOT NULL,
        value_json  TEXT NOT NULL,
        score       REAL,
        outcome     TEXT CHECK (outcome IN ('correct', 'partial', 'incorrect', 'unsure')),
        PRIMARY KEY (response_id, question_id)
      );
    `,
  },
];

export function openDatabase(path: string): DB {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  migrate(db);
  registerSurveyVersion(db);
  return db;
}

export function migrate(db: DB): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)`);
  const applied = new Set(
    (db.prepare("SELECT version FROM schema_migrations").all() as { version: number }[]).map((r) => r.version),
  );
  for (const m of MIGRATIONS) {
    if (applied.has(m.version)) continue;
    db.transaction(() => {
      db.exec(m.sql);
      db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(m.version, new Date().toISOString());
    })();
  }
}

/** Stores a snapshot of the full definition (including the answer key) for auditability. */
function registerSurveyVersion(db: DB): void {
  const json = JSON.stringify(QUESTIONS);
  const now = new Date().toISOString();
  const existing = db.prepare("SELECT definition_json FROM survey_versions WHERE version = ?").get(SURVEY_VERSION) as
    | { definition_json: string }
    | undefined;
  if (!existing) {
    db.prepare("INSERT INTO survey_versions (version, definition_json, created_at, updated_at) VALUES (?, ?, ?, ?)").run(
      SURVEY_VERSION,
      json,
      now,
      now,
    );
  } else if (existing.definition_json !== json) {
    const hasResponses = db.prepare("SELECT 1 FROM responses WHERE survey_version = ? LIMIT 1").get(SURVEY_VERSION);
    if (hasResponses) {
      console.warn(
        `[db] The survey definition changed but SURVEY_VERSION is still ${SURVEY_VERSION} and responses exist. ` +
          "Bump SURVEY_VERSION if the change affects question meaning or scoring.",
      );
    }
    db.prepare("UPDATE survey_versions SET definition_json = ?, updated_at = ? WHERE version = ?").run(json, now, SURVEY_VERSION);
  }
}

// --- Sessions -----------------------------------------------------------------

export interface SessionRow {
  id: string;
  stage: Stage;
  participant_code: string | null;
  survey_version: string;
  started_at: string;
  completed_at: string | null;
  is_demo: number;
}

export function createSession(
  db: DB,
  s: { id: string; stage: Stage; participantCode: string | null; startedAt?: string; isDemo?: boolean },
): void {
  db.prepare(
    "INSERT INTO sessions (id, stage, participant_code, survey_version, started_at, is_demo) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(s.id, s.stage, s.participantCode, SURVEY_VERSION, s.startedAt ?? new Date().toISOString(), s.isDemo ? 1 : 0);
}

export function getSession(db: DB, id: string): SessionRow | undefined {
  return db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as SessionRow | undefined;
}

export function hasResponseForCode(db: DB, code: string, stage: Stage): boolean {
  return !!db.prepare("SELECT 1 FROM responses WHERE participant_code = ? AND stage = ?").get(code, stage);
}

export function codeInUse(db: DB, code: string): boolean {
  return !!db.prepare("SELECT 1 FROM sessions WHERE participant_code = ? LIMIT 1").get(code);
}

// --- Responses ----------------------------------------------------------------

export function getResponseBySession(db: DB, sessionId: string): { id: string } | undefined {
  return db.prepare("SELECT id FROM responses WHERE session_id = ?").get(sessionId) as { id: string } | undefined;
}

export function insertResponse(
  db: DB,
  r: { id: string; session: SessionRow; scored: ScoredResponse; knowledgeMax: number; submittedAt?: string },
): void {
  const submittedAt = r.submittedAt ?? new Date().toISOString();
  const duration = Math.max(0, Math.round((Date.parse(submittedAt) - Date.parse(r.session.started_at)) / 1000));
  db.transaction(() => {
    db.prepare(
      `INSERT INTO responses (id, session_id, stage, participant_code, survey_version, submitted_at, duration_seconds,
         knowledge_score, knowledge_max, fully_correct, confidence, estimated_correct, is_demo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      r.id,
      r.session.id,
      r.session.stage,
      r.session.participant_code,
      r.session.survey_version,
      submittedAt,
      duration,
      r.scored.knowledgeScore,
      r.knowledgeMax,
      r.scored.fullyCorrect,
      r.scored.confidence,
      r.scored.estimatedCorrect,
      r.session.is_demo,
    );
    const insertAnswer = db.prepare(
      "INSERT INTO answers (response_id, question_id, value_json, score, outcome) VALUES (?, ?, ?, ?, ?)",
    );
    for (const a of r.scored.answers) {
      insertAnswer.run(r.id, a.questionId, JSON.stringify(a.value), a.score, a.outcome);
    }
    db.prepare("UPDATE sessions SET completed_at = ? WHERE id = ?").run(submittedAt, r.session.id);
  })();
}

export interface StoredAnswer {
  value: AnswerValue;
  score: number | null;
  outcome: Outcome | null;
}

export interface StoredResponse {
  id: string;
  stage: Stage;
  participantCode: string | null;
  surveyVersion: string;
  submittedAt: string;
  durationSeconds: number | null;
  knowledgeScore: number;
  knowledgeMax: number;
  fullyCorrect: number;
  confidence: number | null;
  estimatedCorrect: number | null;
  isDemo: boolean;
  answers: Map<string, StoredAnswer>;
}

export function loadResponses(db: DB, includeDemo: boolean): StoredResponse[] {
  const rows = db
    .prepare(`SELECT * FROM responses WHERE (? = 1 OR is_demo = 0) ORDER BY submitted_at, id`)
    .all(includeDemo ? 1 : 0) as Record<string, unknown>[];
  const answerRows = db
    .prepare(
      `SELECT a.* FROM answers a JOIN responses r ON r.id = a.response_id WHERE (? = 1 OR r.is_demo = 0)`,
    )
    .all(includeDemo ? 1 : 0) as { response_id: string; question_id: string; value_json: string; score: number | null; outcome: Outcome | null }[];

  const byId = new Map<string, StoredResponse>();
  for (const r of rows) {
    byId.set(r.id as string, {
      id: r.id as string,
      stage: r.stage as Stage,
      participantCode: (r.participant_code as string | null) ?? null,
      surveyVersion: r.survey_version as string,
      submittedAt: r.submitted_at as string,
      durationSeconds: (r.duration_seconds as number | null) ?? null,
      knowledgeScore: r.knowledge_score as number,
      knowledgeMax: r.knowledge_max as number,
      fullyCorrect: r.fully_correct as number,
      confidence: (r.confidence as number | null) ?? null,
      estimatedCorrect: (r.estimated_correct as number | null) ?? null,
      isDemo: r.is_demo === 1,
      answers: new Map(),
    });
  }
  for (const a of answerRows) {
    byId.get(a.response_id)?.answers.set(a.question_id, {
      value: JSON.parse(a.value_json) as AnswerValue,
      score: a.score,
      outcome: a.outcome,
    });
  }
  return [...byId.values()];
}

export function sessionCounts(db: DB, includeDemo: boolean): Record<Stage, { started: number; completed: number }> {
  const rows = db
    .prepare(
      `SELECT stage, COUNT(*) AS started, COUNT(completed_at) AS completed
       FROM sessions WHERE (? = 1 OR is_demo = 0) GROUP BY stage`,
    )
    .all(includeDemo ? 1 : 0) as { stage: Stage; started: number; completed: number }[];
  const out: Record<Stage, { started: number; completed: number }> = {
    pre: { started: 0, completed: 0 },
    post: { started: 0, completed: 0 },
  };
  for (const r of rows) out[r.stage] = { started: r.started, completed: r.completed };
  return out;
}

/** Deletes everything stored under an anonymous code (participant withdrawal). */
export function withdrawCode(db: DB, code: string): { responses: number; sessions: number } {
  return db.transaction(() => {
    const responses = db.prepare("DELETE FROM responses WHERE participant_code = ?").run(code).changes;
    const sessions = db.prepare("DELETE FROM sessions WHERE participant_code = ?").run(code).changes;
    return { responses, sessions };
  })();
}

export function demoResponseCount(db: DB): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM responses WHERE is_demo = 1").get() as { n: number }).n;
}

export function purgeDemoData(db: DB): { responses: number; sessions: number } {
  return db.transaction(() => {
    const responses = db.prepare("DELETE FROM responses WHERE is_demo = 1").run().changes;
    const sessions = db.prepare("DELETE FROM sessions WHERE is_demo = 1").run().changes;
    return { responses, sessions };
  })();
}
