// Recomputes the dashboard's numbers from raw SQL and compares them with the analytics
// report. Exits 1 on any mismatch.
//
//   npm run demo:verify                       checks ./data/demo.db (or DEMO_DATABASE_PATH)
//   npm run demo:verify -- --db ./data/hlac.db   checks any database, e.g. the live one

import "dotenv/config";
import { existsSync } from "node:fs";
import { buildAnalytics } from "../analytics.js";
import { openDatabase } from "../db.js";
import { verifyAnalytics } from "../demo/verify.js";

const args = process.argv.slice(2);
const i = args.indexOf("--db");
const path = i >= 0 ? args[i + 1] : process.env.DEMO_DATABASE_PATH?.trim() || "./data/demo.db";
if (!path || !existsSync(path)) {
  console.error(`No database at ${path}. Create the demo dataset with \`npm run demo:seed\` or pass --db <file>.`);
  process.exit(1);
}

const db = openDatabase(path);
const report = buildAnalytics(db, { includeDemo: true });
const { checks, ok } = verifyAnalytics(db, report);
db.close();

const fmt = (x: number | null) => (x === null ? "—" : Number.isInteger(x) ? String(x) : x.toFixed(6));
const failed = checks.filter((c) => !c.ok);
const width = Math.max(...checks.map((c) => c.name.length));
for (const c of failed.length ? failed : checks.filter((c) => !/option|histogram|confidence =/.test(c.name))) {
  console.log(`${c.ok ? "ok  " : "FAIL"}  ${c.name.padEnd(width)}  expected ${fmt(c.expected).padStart(10)}  dashboard ${fmt(c.actual).padStart(10)}`);
}

const p = report.comparison.paired;
console.log("");
console.log(`Database: ${path}`);
console.log(`PRE n = ${report.scores.pre.n}, POST n = ${report.scores.post.n}, matched pairs = ${p.n}`);
console.log(
  `Mean PRE ${fmt(report.scores.pre.mean)} → POST ${fmt(report.scores.post.mean)}; paired change ${fmt(p.meanChange)}` +
    (p.ci95 ? ` (95% CI ${p.ci95[0].toFixed(2)} to ${p.ci95[1].toFixed(2)})` : "") +
    (p.tTest ? `, t(${p.tTest.df}) = ${p.tTest.statistic.toFixed(2)}, p = ${p.tTest.p.toFixed(4)}` : ""),
);
console.log(`${checks.length - failed.length}/${checks.length} checks match the stored data.${ok ? "" : " MISMATCHES FOUND."}`);
process.exit(ok ? 0 : 1);
