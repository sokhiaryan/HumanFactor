// Creates the synthetic demonstration database (never the live one).
//
//   npm run demo:seed            create ./data/demo.db if it is empty
//   npm run demo:reset           empty it and generate a fresh dataset
//   flags: --seed <n> (default 2026), --pre <n> completed PRE responses (default 64)

import "dotenv/config";
import { openDatabase } from "../db.js";
import { checkDemoTarget, demoTargetFromEnv, DemoTargetError, generateDemoData } from "../demo/generate.js";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const reset = args.includes("--reset");
const seed = Number(flag("seed") ?? 2026);
const preN = Number(flag("pre") ?? 64);

const { target, livePath } = demoTargetFromEnv();
try {
  checkDemoTarget(target, livePath);
} catch (err) {
  if (err instanceof DemoTargetError) {
    console.error(err.message);
    process.exit(1);
  }
  throw err;
}

const db = openDatabase(target);
// Reset empties the tables in place rather than deleting the file, so a demo server
// that is already running sees the fresh dataset instead of a deleted copy.
if (reset) {
  db.transaction(() => {
    db.prepare("DELETE FROM answers").run();
    db.prepare("DELETE FROM responses").run();
    db.prepare("DELETE FROM sessions").run();
  })();
}
const existing = (db.prepare("SELECT (SELECT COUNT(*) FROM sessions) + (SELECT COUNT(*) FROM responses) AS n").get() as { n: number }).n;
if (existing > 0) {
  console.error(`${target} already contains data. Run \`npm run demo:reset\` to replace it with a fresh synthetic dataset.`);
  db.close();
  process.exit(1);
}

const s = generateDemoData(db, { seed, preN });
db.close();
console.log(`Synthetic demonstration dataset written to ${target} (seed ${seed}).`);
console.log(`  PRE:  ${s.preResponses} responses from ${s.preSessions} sessions`);
console.log(`  POST: ${s.postResponses} responses from ${s.postSessions} sessions, ${s.matchedPairs} matched pairs`);
console.log("Run the dashboard on it with `npm run demo`, check it with `npm run demo:verify`.");
