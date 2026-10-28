// Answer validation and scoring.
//
// Scoring methodology (documented in README "Scoring"):
// - Each knowledge item is worth 1 point; the knowledge score is the sum (0–10).
// - Single-choice items: 1 if the correct option is chosen, otherwise 0.
// - The multi-select item uses partial credit: (correct picks − incorrect picks) / number
//   of correct options, floored at 0. This penalises "select everything" strategies.
// - "I'm not sure" scores 0 but is recorded as outcome "unsure", not "incorrect", so
//   analytics can separate uncertainty from misconceptions.
// - Self-assessment, demographic and exposure questions are never scored.

import type { AnswerValue, Answers, Stage } from "../shared/types.js";
import { questionsForStage, type QuestionDefinition } from "./survey/definition.js";

export type Outcome = "correct" | "partial" | "incorrect" | "unsure";

export interface ScoredAnswer {
  questionId: string;
  value: AnswerValue;
  score: number | null;
  outcome: Outcome | null;
}

export interface ScoredResponse {
  answers: ScoredAnswer[];
  knowledgeScore: number;
  /** Number of knowledge items answered fully correctly (used for calibration). */
  fullyCorrect: number;
  confidence: number | null;
  estimatedCorrect: number | null;
}

export class AnswerValidationError extends Error {
  constructor(public fields: Record<string, string>) {
    super("Some answers are missing or invalid");
  }
}

function isBlank(v: unknown): boolean {
  return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
}

/** Returns a cleaned value, or an error message. */
function validateOne(q: QuestionDefinition, raw: unknown): { value?: AnswerValue; error?: string } {
  const optionIds = new Set((q.options ?? []).map((o) => o.id));
  switch (q.kind) {
    case "single": {
      if (typeof raw !== "string" || !optionIds.has(raw)) return { error: "Choose one of the options" };
      return { value: raw };
    }
    case "multi": {
      if (!Array.isArray(raw) || raw.some((v) => typeof v !== "string" || !optionIds.has(v))) {
        return { error: "Choose one or more of the options" };
      }
      const unique = [...new Set(raw as string[])];
      const exclusive = (q.options ?? []).filter((o) => o.exclusive).map((o) => o.id);
      if (unique.length > 1 && unique.some((v) => exclusive.includes(v))) {
        return { error: "That option can't be combined with others" };
      }
      return { value: unique.sort() };
    }
    case "likert":
    case "estimate": {
      const { min, max } = q.scale!;
      if (typeof raw !== "number" || !Number.isInteger(raw) || raw < min || raw > max) {
        return { error: `Choose a whole number from ${min} to ${max}` };
      }
      return { value: raw };
    }
  }
}

export function scoreAnswer(q: QuestionDefinition, value: AnswerValue): { score: number; outcome: Outcome } | null {
  if (!q.key) return null;
  const correct = new Set(q.key.correct);
  const picks = Array.isArray(value) ? value : [String(value)];
  if (picks.includes("unsure")) return { score: 0, outcome: "unsure" };

  if (q.kind === "single") {
    return correct.has(picks[0]) ? { score: 1, outcome: "correct" } : { score: 0, outcome: "incorrect" };
  }
  const hits = picks.filter((p) => correct.has(p)).length;
  const misses = picks.length - hits;
  const score = Math.max(0, (hits - misses) / correct.size);
  const rounded = Math.round(score * 1000) / 1000;
  return { score: rounded, outcome: rounded === 1 ? "correct" : rounded > 0 ? "partial" : "incorrect" };
}

/**
 * Validates every answer for the given stage and scores the knowledge items.
 * Unknown question ids are rejected so the stored data always matches the definition.
 */
export function validateAndScore(stage: Stage, input: Answers): ScoredResponse {
  const questions = questionsForStage(stage);
  const known = new Set(questions.map((q) => q.id));
  const errors: Record<string, string> = {};

  for (const id of Object.keys(input)) {
    if (!known.has(id)) errors[id] = "Unknown question";
  }

  const answers: ScoredAnswer[] = [];
  let knowledgeScore = 0;
  let fullyCorrect = 0;
  let confidence: number | null = null;
  let estimatedCorrect: number | null = null;

  for (const q of questions) {
    const raw = input[q.id];
    if (isBlank(raw)) {
      if (q.required) errors[q.id] = "This question needs an answer";
      continue;
    }
    const { value, error } = validateOne(q, raw);
    if (error || value === undefined) {
      errors[q.id] = error ?? "Invalid answer";
      continue;
    }
    const scored = scoreAnswer(q, value);
    if (scored) {
      knowledgeScore += scored.score;
      if (scored.score === 1) fullyCorrect++;
    }
    if (q.id === "s_confidence") confidence = value as number;
    if (q.id === "s_estimate") estimatedCorrect = value as number;
    answers.push({ questionId: q.id, value, score: scored?.score ?? null, outcome: scored?.outcome ?? null });
  }

  if (Object.keys(errors).length) throw new AnswerValidationError(errors);
  return {
    answers,
    knowledgeScore: Math.round(knowledgeScore * 1000) / 1000,
    fullyCorrect,
    confidence,
    estimatedCorrect,
  };
}
