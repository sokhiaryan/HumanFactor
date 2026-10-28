import type { Answers, Stage } from "../shared/types.js";
import type { Config } from "../server/config.js";
import { questionsForStage } from "../server/survey/definition.js";

export const ADMIN_PASSWORD = "test-password-123456";

export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    port: 0,
    databasePath: ":memory:",
    production: false,
    adminPassword: ADMIN_PASSWORD,
    sessionSecret: "x".repeat(64),
    trustProxy: false,
    ...overrides,
  };
}

/**
 * Builds a complete, valid answer set. `correctItems` = how many of the 10 knowledge
 * items (in order) are answered correctly; the rest get a wrong option.
 */
export function makeAnswers(stage: Stage, correctItems = 10, extra: Answers = {}): Answers {
  const answers: Answers = {};
  let k = 0;
  for (const q of questionsForStage(stage)) {
    if (q.key) {
      const right = k++ < correctItems;
      const wrong = q.options!.find((o) => !q.key!.correct.includes(o.id) && o.id !== "unsure")!.id;
      answers[q.id] = q.kind === "multi" ? (right ? [...q.key.correct] : [wrong]) : right ? q.key.correct[0] : wrong;
    } else if (q.id === "s_confidence") answers[q.id] = 3;
    else if (q.id === "s_estimate") answers[q.id] = 7;
    else if (q.id === "r_exposure") answers[q.id] = ["social_posts"];
  }
  return { ...answers, ...extra };
}
