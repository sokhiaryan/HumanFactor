// Types shared by the server and the web client.
// Anything in here may be sent to the browser, so it must never contain answer keys.

export type Stage = "pre" | "post";
export const STAGES: Stage[] = ["pre", "post"];

export type QuestionKind = "single" | "multi" | "likert" | "estimate";
export type Section = "about" | "self" | "knowledge" | "reflection";

export interface Option {
  id: string;
  label: string;
  /** Render the label in a monospace face (used for URLs). */
  mono?: boolean;
  /** Selecting this option clears all others (e.g. "I'm not sure", "None of these"). */
  exclusive?: boolean;
}

export type Stimulus =
  | {
      type: "email";
      fromName: string;
      fromAddress: string;
      subject: string;
      body: string[];
      cta?: string;
    }
  | { type: "sms"; sender: string; body: string }
  | { type: "chat"; platform: string; contact: string; messages: string[]; incomingSms?: string }
  | { type: "notification"; app: string; title: string; body: string; count?: number }
  | { type: "sign"; heading: string; body: string };

export interface PublicQuestion {
  id: string;
  kind: QuestionKind;
  section: Section;
  prompt: string;
  help?: string;
  stimulus?: Stimulus;
  options?: Option[];
  /** Shuffle option order per participant. Exclusive options always stay last. */
  shuffle?: boolean;
  scale?: { min: number; max: number; minLabel: string; maxLabel: string; labels?: string[] };
  required: boolean;
}

export interface PublicSurvey {
  version: string;
  stage: Stage;
  title: string;
  topic: string;
  estimatedMinutes: number;
  questions: PublicQuestion[];
}

/** Answer value submitted for one question. */
export type AnswerValue = string | string[] | number;
export type Answers = Record<string, AnswerValue>;

export interface CreateSessionRequest {
  stage: Stage;
  participantCode?: string | null;
}

export interface CreateSessionResponse {
  sessionId: string;
  stage: Stage;
  participantCode: string | null;
  /** POST only: whether a PRE response exists for this code. */
  matchedPre?: boolean;
}

export interface SubmitRequest {
  sessionId: string;
  answers: Answers;
}

export interface SubmitResponse {
  ok: true;
  stage: Stage;
  participantCode: string | null;
  alreadyRecorded: boolean;
}

export interface ApiError {
  error: string;
  message: string;
  fields?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Admin analytics
// ---------------------------------------------------------------------------

export interface TestResult {
  statistic: number;
  df?: number;
  p: number;
}

export interface ScoreSummary {
  n: number;
  mean: number | null;
  median: number | null;
  sd: number | null;
  min: number | null;
  max: number | null;
  q1: number | null;
  q3: number | null;
  /** 95% CI for the mean (t-based). */
  ci95: [number, number] | null;
  /** Counts per integer bin: bin i covers [i, i+1), last bin includes the maximum. */
  histogram: { bin: number; count: number }[];
}

export interface StageOverview {
  started: number;
  completed: number;
  /** completed / started; null when nothing has been started. */
  completionRate: number | null;
  abandoned: number;
  withCode: number;
  medianDurationSeconds: number | null;
}

export interface OptionStat {
  id: string;
  label: string;
  count: number;
  share: number;
  isCorrect: boolean;
  misconception?: string;
}

export interface ItemStageStats {
  n: number;
  /** Mean item score (0..1). For single-choice items this equals the proportion correct. */
  accuracy: number | null;
  /** Share answering exactly right (score == 1). */
  fullyCorrect: number | null;
  unsureRate: number | null;
  options: OptionStat[];
}

export type ChangeDirection = "improved" | "unchanged" | "declined" | "insufficient";

export interface ItemAnalytics {
  id: string;
  number: number;
  shortLabel: string;
  topic: string;
  topicLabel: string;
  prompt: string;
  kind: QuestionKind;
  byStage: Record<Stage, ItemStageStats>;
  change: { accuracyDelta: number | null; direction: ChangeDirection };
  paired: {
    n: number;
    improved: number;
    declined: number;
    stayedCorrect: number;
    stayedIncorrect: number;
    mcnemarP: number | null;
  };
}

export interface MisconceptionStat {
  itemId: string;
  itemNumber: number;
  shortLabel: string;
  optionLabel: string;
  misconception: string;
  stage: Stage;
  count: number;
  share: number;
}

export interface TopicStat {
  topic: string;
  label: string;
  itemIds: string[];
  byStage: Record<Stage, { n: number; accuracy: number | null }>;
}

export interface PairedComparison {
  n: number;
  meanPre: number | null;
  meanPost: number | null;
  meanChange: number | null;
  sdChange: number | null;
  ci95: [number, number] | null;
  tTest: TestResult | null;
  wilcoxon: (TestResult & { nNonZero: number }) | null;
  cohensDz: number | null;
  improved: number;
  unchanged: number;
  declined: number;
  /** Anonymous score pairs (no codes) for slope / scatter charts. */
  pairs: { pre: number; post: number }[];
}

export interface IndependentComparison {
  preN: number;
  postN: number;
  meanDiff: number | null;
  welch: TestResult | null;
  cohensD: number | null;
}

export interface SelfAssessmentStats {
  n: number;
  confidenceMean: number | null;
  /** Counts for ratings 1..5 (index 0 = rating 1). */
  confidenceDistribution: number[];
  estimateMean: number | null;
  actualCorrectMean: number | null;
  /** Mean of (estimated correct − actual fully-correct count). Positive = overconfident. */
  calibrationMean: number | null;
  /** Spearman correlation between confidence rating and knowledge score. */
  confidenceScoreRho: number | null;
}

export interface CategoricalStat {
  questionId: string;
  label: string;
  stage: Stage;
  answered: number;
  skipped: number;
  /** meanScore: mean knowledge score of respondents choosing this option (same stage). */
  options: { id: string; label: string; count: number; meanScore: number | null }[];
}

export interface AnalyticsReport {
  generatedAt: string;
  includesDemo: boolean;
  /** "demo" when the server runs against the synthetic demonstration database. */
  instance: "live" | "demo";
  demoResponsesInDatabase: number;
  survey: { version: string; title: string; knowledgeMax: number; knowledgeItemCount: number };
  overview: {
    totalResponses: number;
    byStage: Record<Stage, StageOverview>;
    matchedPairs: number;
    unmatchedPost: number;
  };
  scores: Record<Stage, ScoreSummary>;
  items: ItemAnalytics[];
  topMisconceptions: MisconceptionStat[];
  topics: TopicStat[];
  comparison: { independent: IndependentComparison; paired: PairedComparison };
  selfAssessment: Record<Stage, SelfAssessmentStats>;
  demographics: CategoricalStat[];
  exposure: {
    stat: CategoricalStat | null;
    /** "exposed" = saw at least one campaign element; "notExposed" = chose "None of these". */
    postScoreByExposure: {
      group: "exposed" | "notExposed";
      n: number;
      mean: number | null;
      pairedN: number;
      meanChange: number | null;
    }[];
  };
  dataQuality: {
    warnings: string[];
    missingOptional: { questionId: string; label: string; stage: Stage; missing: number; of: number }[];
  };
  caveats: string[];
}

export interface AdminQuestionKey {
  id: string;
  number: number | null;
  prompt: string;
  shortLabel: string;
  kind: QuestionKind;
  stages: Stage[];
  topic?: string;
  correct: string[];
  rationale?: string;
  options: (Option & { isCorrect: boolean; misconception?: string })[];
}
