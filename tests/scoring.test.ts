import { describe, expect, it } from "vitest";
import { AnswerValidationError, scoreAnswer, validateAndScore } from "../server/scoring.js";
import { getQuestion, KNOWLEDGE_ITEMS, KNOWLEDGE_MAX, questionsForStage } from "../server/survey/definition.js";
import { makeAnswers } from "./helpers.js";

const multi = getQuestion("k04_warning_signs")!;
const single = getQuestion("k01_account_email")!;

function fieldsOf(fn: () => unknown): Record<string, string> {
  try {
    fn();
  } catch (e) {
    if (e instanceof AnswerValidationError) return e.fields;
    throw e;
  }
  throw new Error("expected validation error");
}

describe("survey definition", () => {
  it("has 10 scored knowledge items shared by both stages", () => {
    expect(KNOWLEDGE_ITEMS).toHaveLength(10);
    expect(KNOWLEDGE_MAX).toBe(10);
    for (const q of KNOWLEDGE_ITEMS) expect(q.stages).toEqual(["pre", "post"]);
  });

  it("stays within 10–15 questions per stage", () => {
    expect(questionsForStage("pre")).toHaveLength(15);
    expect(questionsForStage("post")).toHaveLength(13);
  });

  it("has a consistent answer key for every knowledge item", () => {
    for (const q of KNOWLEDGE_ITEMS) {
      const ids = q.options!.map((o) => o.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const c of q.key!.correct) expect(ids).toContain(c);
      for (const m of Object.keys(q.key!.misconceptions)) {
        expect(ids).toContain(m);
        expect(q.key!.correct).not.toContain(m);
      }
      expect(ids).toContain("unsure");
      if (q.kind === "single") expect(q.key!.correct).toHaveLength(1);
    }
  });
});

describe("scoreAnswer", () => {
  it("scores single-choice items 1/0", () => {
    expect(scoreAnswer(single, "c")).toEqual({ score: 1, outcome: "correct" });
    expect(scoreAnswer(single, "a")).toEqual({ score: 0, outcome: "incorrect" });
  });

  it("separates 'not sure' from incorrect", () => {
    expect(scoreAnswer(single, "unsure")).toEqual({ score: 0, outcome: "unsure" });
    expect(scoreAnswer(multi, ["unsure"])).toEqual({ score: 0, outcome: "unsure" });
  });

  it("gives partial credit on the multi-select item", () => {
    expect(scoreAnswer(multi, ["urgency", "mismatch", "credentials", "attachment"])).toEqual({ score: 1, outcome: "correct" });
    expect(scoreAnswer(multi, ["urgency", "mismatch"])).toEqual({ score: 0.5, outcome: "partial" });
    expect(scoreAnswer(multi, ["urgency", "mismatch", "hours"])).toEqual({ score: 0.25, outcome: "partial" });
  });

  it("penalises selecting everything and floors at zero", () => {
    expect(scoreAnswer(multi, ["urgency", "mismatch", "credentials", "attachment", "hours", "logo"])?.score).toBe(0.5);
    expect(scoreAnswer(multi, ["hours", "logo"])).toEqual({ score: 0, outcome: "incorrect" });
    expect(scoreAnswer(multi, ["urgency", "hours", "logo"])?.score).toBe(0);
  });

  it("does not score unscored questions", () => {
    expect(scoreAnswer(getQuestion("s_confidence")!, 4)).toBeNull();
  });
});

describe("validateAndScore", () => {
  it("scores a fully correct response 10/10", () => {
    const r = validateAndScore("pre", makeAnswers("pre", 10));
    expect(r.knowledgeScore).toBe(10);
    expect(r.fullyCorrect).toBe(10);
    expect(r.confidence).toBe(3);
    expect(r.estimatedCorrect).toBe(7);
  });

  it("sums item scores", () => {
    expect(validateAndScore("post", makeAnswers("post", 6)).knowledgeScore).toBe(6);
    expect(validateAndScore("post", makeAnswers("post", 0)).knowledgeScore).toBe(0);
    const partial = validateAndScore("pre", makeAnswers("pre", 10, { k04_warning_signs: ["urgency", "mismatch"] }));
    expect(partial.knowledgeScore).toBe(9.5);
    expect(partial.fullyCorrect).toBe(9);
  });

  it("accepts 0 as a valid estimate (not treated as blank)", () => {
    expect(validateAndScore("pre", makeAnswers("pre", 3, { s_estimate: 0 })).estimatedCorrect).toBe(0);
  });

  it("lets optional demographic questions be skipped or answered", () => {
    expect(() => validateAndScore("pre", makeAnswers("pre"))).not.toThrow();
    const r = validateAndScore("pre", makeAnswers("pre", 10, { d_year: "y2", d_training: "no" }));
    expect(r.answers.find((a) => a.questionId === "d_year")?.value).toBe("y2");
  });

  it("rejects missing required answers", () => {
    const answers = makeAnswers("pre");
    delete answers.k05_parcel_sms;
    delete answers.s_confidence;
    expect(Object.keys(fieldsOf(() => validateAndScore("pre", answers)))).toEqual(["s_confidence", "k05_parcel_sms"]);
  });

  it("requires the exposure question only at POST", () => {
    const post = makeAnswers("post");
    delete post.r_exposure;
    expect(fieldsOf(() => validateAndScore("post", post))).toHaveProperty("r_exposure");
  });

  it("rejects unknown questions, including another stage's questions", () => {
    expect(fieldsOf(() => validateAndScore("pre", makeAnswers("pre", 10, { hacked: "x" })))).toHaveProperty("hacked");
    expect(fieldsOf(() => validateAndScore("post", makeAnswers("post", 10, { d_year: "y1" })))).toHaveProperty("d_year");
  });

  it("rejects invalid values", () => {
    expect(fieldsOf(() => validateAndScore("pre", makeAnswers("pre", 10, { k01_account_email: "z" })))).toHaveProperty("k01_account_email");
    expect(fieldsOf(() => validateAndScore("pre", makeAnswers("pre", 10, { k01_account_email: ["c"] })))).toHaveProperty("k01_account_email");
    expect(fieldsOf(() => validateAndScore("pre", makeAnswers("pre", 10, { s_confidence: 6 })))).toHaveProperty("s_confidence");
    expect(fieldsOf(() => validateAndScore("pre", makeAnswers("pre", 10, { s_confidence: 2.5 })))).toHaveProperty("s_confidence");
    expect(fieldsOf(() => validateAndScore("pre", makeAnswers("pre", 10, { s_estimate: 11 })))).toHaveProperty("s_estimate");
    expect(fieldsOf(() => validateAndScore("pre", makeAnswers("pre", 10, { k04_warning_signs: ["urgency", "unsure"] })))).toHaveProperty(
      "k04_warning_signs",
    );
  });

  it("de-duplicates multi-select picks", () => {
    const r = validateAndScore("pre", makeAnswers("pre", 10, { k04_warning_signs: ["urgency", "urgency", "mismatch"] }));
    expect(r.answers.find((a) => a.questionId === "k04_warning_signs")?.value).toEqual(["mismatch", "urgency"]);
    expect(r.knowledgeScore).toBe(9.5);
  });
});
