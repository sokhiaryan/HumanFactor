// Independent check that the dashboard's analytics match the stored rows.
//
// Every expected value here is recomputed straight from SQL (and simple arithmetic),
// without loadResponses() or buildAnalytics()'s helpers, then compared with the report
// the dashboard actually serves. Works on the demo database and the live one alike.

import type { AnalyticsReport } from "../../shared/types.js";
import { STAGES } from "../../shared/types.js";
import { buildAnalytics } from "../analytics.js";
import type { DB } from "../db.js";
import { KNOWLEDGE_ITEMS, KNOWLEDGE_MAX } from "../survey/definition.js";

export interface Check {
  name: string;
  expected: number | null;
  actual: number | null;
  ok: boolean;
}

const TOL = 1e-9;

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function verifyAnalytics(db: DB, report?: AnalyticsReport): { checks: Check[]; ok: boolean } {
  const r = report ?? buildAnalytics(db, { includeDemo: true });
  const checks: Check[] = [];
  const add = (name: string, expected: number | null, actual: number | null | undefined) => {
    const a = actual ?? null;
    const ok = expected === null || a === null ? expected === a : Math.abs(expected - a) <= TOL;
    checks.push({ name, expected, actual: a, ok });
  };

  const one = <T>(sql: string, ...params: unknown[]) => db.prepare(sql).get(...params) as T;
  const all = <T>(sql: string, ...params: unknown[]) => db.prepare(sql).all(...params) as T[];

  add("responses · total", one<{ n: number }>("SELECT COUNT(*) AS n FROM responses").n, r.overview.totalResponses);

  for (const st of STAGES) {
    const S = st.toUpperCase();
    const scores = all<{ s: number }>("SELECT knowledge_score AS s FROM responses WHERE stage = ?", st).map((x) => x.s);
    const sessions = one<{ started: number; completed: number }>(
      "SELECT COUNT(*) AS started, COUNT(completed_at) AS completed FROM sessions WHERE stage = ?",
      st,
    );
    add(`${S} · responses`, scores.length, r.scores[st].n);
    add(`${S} · sessions started`, sessions.started, r.overview.byStage[st].started);
    add(`${S} · sessions completed`, sessions.completed, r.overview.byStage[st].completed);
    add(`${S} · mean score`, avg(scores), r.scores[st].mean);
    add(`${S} · median score`, median(scores), r.scores[st].median);

    // Histogram: bin = floor(score), the maximum score shares the last bin.
    const bins = new Array<number>(KNOWLEDGE_MAX + 1).fill(0);
    for (const x of scores) bins[Math.min(KNOWLEDGE_MAX, Math.floor(x + 1e-9))]++;
    bins.forEach((count, bin) => add(`${S} · histogram bin ${bin}`, count, r.scores[st].histogram.find((h) => h.bin === bin)?.count));

    // Confidence distribution
    const conf = all<{ c: number; n: number }>(
      "SELECT confidence AS c, COUNT(*) AS n FROM responses WHERE stage = ? AND confidence IS NOT NULL GROUP BY confidence",
      st,
    );
    for (let c = 1; c <= 5; c++) add(`${S} · confidence = ${c}`, conf.find((x) => x.c === c)?.n ?? 0, r.selfAssessment[st].confidenceDistribution[c - 1]);

    // Item accuracy and option counts straight from the answers table
    KNOWLEDGE_ITEMS.forEach((q, i) => {
      const item = r.items[i];
      const rows = all<{ value_json: string; score: number }>(
        "SELECT a.value_json, a.score FROM answers a JOIN responses r ON r.id = a.response_id WHERE r.stage = ? AND a.question_id = ?",
        st,
        q.id,
      );
      add(`${S} · Q${i + 1} mean item score`, avg(rows.map((x) => x.score)), item.byStage[st].accuracy);
      const counts = new Map<string, number>();
      for (const row of rows) {
        const v = JSON.parse(row.value_json) as string | string[];
        for (const id of Array.isArray(v) ? v : [v]) counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      for (const o of q.options ?? []) {
        add(`${S} · Q${i + 1} option "${o.id}" count`, counts.get(o.id) ?? 0, item.byStage[st].options.find((x) => x.id === o.id)?.count);
      }
    });
  }

  // Exposure (POST)
  if (r.exposure.stat) {
    const rows = all<{ value_json: string }>(
      "SELECT a.value_json FROM answers a JOIN responses r ON r.id = a.response_id WHERE r.stage = 'post' AND a.question_id = 'r_exposure'",
    );
    const counts = new Map<string, number>();
    for (const row of rows) for (const id of JSON.parse(row.value_json) as string[]) counts.set(id, (counts.get(id) ?? 0) + 1);
    for (const o of r.exposure.stat.options) add(`POST · exposure "${o.id}"`, counts.get(o.id) ?? 0, o.count);
  }

  // Matched pairs and paired change
  const pairs = all<{ pre: number; post: number }>(
    `SELECT p.knowledge_score AS pre, q.knowledge_score AS post
     FROM responses p JOIN responses q ON q.participant_code = p.participant_code
     WHERE p.stage = 'pre' AND q.stage = 'post' AND p.participant_code IS NOT NULL`,
  );
  const diffs = pairs.map((p) => p.post - p.pre);
  add("pairs · matched", pairs.length, r.overview.matchedPairs);
  add("pairs · unmatched POST", (r.scores.post.n ?? 0) - pairs.length, r.overview.unmatchedPost);
  add("pairs · mean PRE", avg(pairs.map((p) => p.pre)), r.comparison.paired.meanPre);
  add("pairs · mean POST", avg(pairs.map((p) => p.post)), r.comparison.paired.meanPost);
  add("pairs · mean change", avg(diffs), r.comparison.paired.meanChange);
  add("pairs · improved", diffs.filter((d) => d > 0).length, r.comparison.paired.improved);
  add("pairs · unchanged", diffs.filter((d) => d === 0).length, r.comparison.paired.unchanged);
  add("pairs · declined", diffs.filter((d) => d < 0).length, r.comparison.paired.declined);

  // Stored-row integrity: the per-response totals agree with the per-answer scores.
  const knowledgeIds = KNOWLEDGE_ITEMS.map((q) => q.id);
  const placeholders = knowledgeIds.map(() => "?").join(",");
  const integrity = all<{ knowledge_score: number; fully_correct: number; sum: number | null; full: number }>(
    `SELECT r.knowledge_score, r.fully_correct,
            (SELECT SUM(score) FROM answers a WHERE a.response_id = r.id AND a.question_id IN (${placeholders})) AS sum,
            (SELECT COUNT(*) FROM answers a WHERE a.response_id = r.id AND a.question_id IN (${placeholders}) AND a.score = 1) AS full
     FROM responses r`,
    ...knowledgeIds,
    ...knowledgeIds,
  );
  add("integrity · score ≠ sum of item scores", 0, integrity.filter((x) => Math.abs(x.knowledge_score - (x.sum ?? 0)) > 1e-6).length);
  add("integrity · fully_correct ≠ count of score 1", 0, integrity.filter((x) => x.fully_correct !== x.full).length);

  return { checks, ok: checks.every((c) => c.ok) };
}
