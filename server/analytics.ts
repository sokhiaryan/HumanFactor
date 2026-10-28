// Turns stored responses into the dashboard's AnalyticsReport.
// Everything here is computed from the database at request time — there are no
// hard-coded or cached results.

import type {
  AnalyticsReport,
  CategoricalStat,
  ChangeDirection,
  ItemAnalytics,
  ItemStageStats,
  MisconceptionStat,
  PairedComparison,
  ScoreSummary,
  SelfAssessmentStats,
  Stage,
  StageOverview,
  TopicStat,
} from "../shared/types.js";
import { STAGES } from "../shared/types.js";
import { demoResponseCount, loadResponses, sessionCounts, type DB, type StoredResponse } from "./db.js";
import * as s from "./stats.js";
import {
  KNOWLEDGE_ITEMS,
  KNOWLEDGE_MAX,
  QUESTIONS,
  SURVEY_TITLE,
  SURVEY_VERSION,
  TOPICS,
  type QuestionDefinition,
  type Topic,
} from "./survey/definition.js";

/** Minimum respondents per stage before an item's change is classified. */
const MIN_STAGE_N = 5;
/** Accuracy change (in proportion) treated as a meaningful descriptive shift. */
const CHANGE_THRESHOLD = 0.1;
const TARGET_SAMPLE = 30;

export const CAVEATS = [
  "PRE→POST differences describe observed change, not its cause. Without a control group, a higher POST score could also reflect seeing the same questions twice (testing effect), discussion between participants, outside news, or who chose to take part.",
  "The independent-groups comparison treats all PRE and all POST responses as separate samples even though many are the same people; it is shown for context. Prefer the paired results for participants whose codes match.",
  "Item-level p-values (McNemar) are not corrected for multiple comparisons across 10 items; treat them as exploratory.",
  "Participants are a self-selected convenience sample, so results may not generalise to all students.",
  "The Wilcoxon p-value uses a normal approximation, which is less accurate with fewer than about 10 non-zero changes.",
];

function scoreSummary(scores: number[]): ScoreSummary {
  const histogram = Array.from({ length: KNOWLEDGE_MAX + 1 }, (_, bin) => ({ bin, count: 0 }));
  for (const x of scores) histogram[Math.min(KNOWLEDGE_MAX, Math.floor(x + 1e-9))].count++;
  return {
    n: scores.length,
    mean: s.mean(scores),
    median: s.median(scores),
    sd: s.sd(scores),
    min: scores.length ? Math.min(...scores) : null,
    max: scores.length ? Math.max(...scores) : null,
    q1: s.quantile(scores, 0.25),
    q3: s.quantile(scores, 0.75),
    ci95: s.meanCi95(scores),
    histogram,
  };
}

function pickedOptions(value: unknown): string[] {
  return Array.isArray(value) ? (value as string[]) : [String(value)];
}

function itemStageStats(q: QuestionDefinition, rs: StoredResponse[]): ItemStageStats {
  const answered = rs.filter((r) => r.answers.has(q.id));
  const n = answered.length;
  const counts = new Map<string, number>();
  for (const r of answered) for (const id of pickedOptions(r.answers.get(q.id)!.value)) counts.set(id, (counts.get(id) ?? 0) + 1);
  const scores = answered.map((r) => r.answers.get(q.id)!.score ?? 0);
  return {
    n,
    accuracy: s.mean(scores),
    fullyCorrect: n ? scores.filter((x) => x === 1).length / n : null,
    unsureRate: n ? answered.filter((r) => r.answers.get(q.id)!.outcome === "unsure").length / n : null,
    options: (q.options ?? []).map((o) => ({
      id: o.id,
      label: o.label,
      count: counts.get(o.id) ?? 0,
      share: n ? (counts.get(o.id) ?? 0) / n : 0,
      isCorrect: q.key!.correct.includes(o.id),
      misconception: q.key!.misconceptions[o.id],
    })),
  };
}

function classify(pre: ItemStageStats, post: ItemStageStats): { accuracyDelta: number | null; direction: ChangeDirection } {
  if (pre.accuracy === null || post.accuracy === null) return { accuracyDelta: null, direction: "insufficient" };
  const delta = post.accuracy - pre.accuracy;
  if (pre.n < MIN_STAGE_N || post.n < MIN_STAGE_N) return { accuracyDelta: delta, direction: "insufficient" };
  if (Math.abs(delta) < CHANGE_THRESHOLD) return { accuracyDelta: delta, direction: "unchanged" };
  return { accuracyDelta: delta, direction: delta > 0 ? "improved" : "declined" };
}

function categorical(q: QuestionDefinition, stage: Stage, rs: StoredResponse[]): CategoricalStat {
  const counts = new Map<string, number[]>();
  let answered = 0;
  for (const r of rs) {
    const a = r.answers.get(q.id);
    if (!a) continue;
    answered++;
    for (const id of pickedOptions(a.value)) counts.set(id, [...(counts.get(id) ?? []), r.knowledgeScore]);
  }
  return {
    questionId: q.id,
    label: q.shortLabel,
    stage,
    answered,
    skipped: rs.length - answered,
    options: (q.options ?? []).map((o) => ({
      id: o.id,
      label: o.label,
      count: counts.get(o.id)?.length ?? 0,
      meanScore: s.mean(counts.get(o.id) ?? []),
    })),
  };
}

function selfAssessment(rs: StoredResponse[]): SelfAssessmentStats {
  const withConf = rs.filter((r) => r.confidence !== null);
  const withEst = rs.filter((r) => r.estimatedCorrect !== null);
  const dist = [0, 0, 0, 0, 0];
  for (const r of withConf) dist[r.confidence! - 1]++;
  return {
    n: rs.length,
    confidenceMean: s.mean(withConf.map((r) => r.confidence!)),
    confidenceDistribution: dist,
    estimateMean: s.mean(withEst.map((r) => r.estimatedCorrect!)),
    actualCorrectMean: s.mean(rs.map((r) => r.fullyCorrect)),
    calibrationMean: s.mean(withEst.map((r) => r.estimatedCorrect! - r.fullyCorrect)),
    confidenceScoreRho: s.spearman(
      withConf.map((r) => r.confidence!),
      withConf.map((r) => r.knowledgeScore),
    ),
  };
}

export function buildAnalytics(db: DB, opts: { includeDemo: boolean }): AnalyticsReport {
  const all = loadResponses(db, opts.includeDemo);
  const byStage: Record<Stage, StoredResponse[]> = {
    pre: all.filter((r) => r.stage === "pre"),
    post: all.filter((r) => r.stage === "post"),
  };
  const sessions = sessionCounts(db, opts.includeDemo);

  // --- Matching -----------------------------------------------------------
  const preByCode = new Map(byStage.pre.filter((r) => r.participantCode).map((r) => [r.participantCode!, r]));
  const pairs = byStage.post
    .filter((r) => r.participantCode && preByCode.has(r.participantCode))
    .map((post) => ({ pre: preByCode.get(post.participantCode!)!, post }));

  // --- Overview -----------------------------------------------------------
  const overviewByStage = {} as Record<Stage, StageOverview>;
  for (const st of STAGES) {
    const { started, completed } = sessions[st];
    const durations = byStage[st].map((r) => r.durationSeconds).filter((d): d is number => d !== null);
    overviewByStage[st] = {
      started,
      completed,
      completionRate: started ? completed / started : null,
      abandoned: started - completed,
      withCode: byStage[st].filter((r) => r.participantCode).length,
      medianDurationSeconds: s.median(durations),
    };
  }

  // --- Items ----------------------------------------------------------------
  const items: ItemAnalytics[] = KNOWLEDGE_ITEMS.map((q, i) => {
    const pre = itemStageStats(q, byStage.pre);
    const post = itemStageStats(q, byStage.post);
    let improved = 0;
    let declined = 0;
    let stayedCorrect = 0;
    let stayedIncorrect = 0;
    for (const p of pairs) {
      const a = p.pre.answers.get(q.id)?.score === 1;
      const b = p.post.answers.get(q.id)?.score === 1;
      if (!a && b) improved++;
      else if (a && !b) declined++;
      else if (a && b) stayedCorrect++;
      else stayedIncorrect++;
    }
    return {
      id: q.id,
      number: i + 1,
      shortLabel: q.shortLabel,
      topic: q.key!.topic,
      topicLabel: TOPICS[q.key!.topic],
      prompt: q.prompt,
      kind: q.kind,
      byStage: { pre, post },
      change: classify(pre, post),
      paired: { n: pairs.length, improved, declined, stayedCorrect, stayedIncorrect, mcnemarP: s.mcnemarExact(improved, declined) },
    };
  });

  const topMisconceptions: MisconceptionStat[] = items
    .flatMap((item) =>
      STAGES.flatMap((stage) =>
        item.byStage[stage].options
          .filter((o) => o.misconception && o.count > 0)
          .map((o) => ({
            itemId: item.id,
            itemNumber: item.number,
            shortLabel: item.shortLabel,
            optionLabel: o.label,
            misconception: o.misconception!,
            stage,
            count: o.count,
            share: o.share,
          })),
      ),
    )
    .sort((a, b) => b.share - a.share || b.count - a.count)
    .slice(0, 12);

  const topics: TopicStat[] = (Object.keys(TOPICS) as Topic[]).map((topic) => {
    const ids = KNOWLEDGE_ITEMS.filter((q) => q.key!.topic === topic).map((q) => q.id);
    const byStageTopic = {} as TopicStat["byStage"];
    for (const st of STAGES) {
      const perResponse = byStage[st].map((r) => s.mean(ids.map((id) => r.answers.get(id)?.score ?? 0))!);
      byStageTopic[st] = { n: perResponse.length, accuracy: s.mean(perResponse) };
    }
    return { topic, label: TOPICS[topic], itemIds: ids, byStage: byStageTopic };
  });

  // --- Comparisons ------------------------------------------------------------
  const preScores = byStage.pre.map((r) => r.knowledgeScore);
  const postScores = byStage.post.map((r) => r.knowledgeScore);
  const diffs = pairs.map((p) => p.post.knowledgeScore - p.pre.knowledgeScore);
  const sdChange = s.sd(diffs);
  const meanChange = s.mean(diffs);
  const wilcoxon = s.wilcoxonSignedRank(diffs);
  const paired: PairedComparison = {
    n: pairs.length,
    meanPre: s.mean(pairs.map((p) => p.pre.knowledgeScore)),
    meanPost: s.mean(pairs.map((p) => p.post.knowledgeScore)),
    meanChange,
    sdChange,
    ci95: s.meanCi95(diffs),
    tTest: s.pairedTTest(diffs),
    wilcoxon: wilcoxon ? { statistic: wilcoxon.statistic, p: wilcoxon.p, nNonZero: wilcoxon.nNonZero } : null,
    cohensDz: meanChange !== null && sdChange ? meanChange / sdChange : null,
    improved: diffs.filter((d) => d > 0).length,
    unchanged: diffs.filter((d) => d === 0).length,
    declined: diffs.filter((d) => d < 0).length,
    pairs: pairs.map((p) => ({ pre: p.pre.knowledgeScore, post: p.post.knowledgeScore })),
  };
  const preMean = s.mean(preScores);
  const postMean = s.mean(postScores);

  // --- Demographics & exposure --------------------------------------------------
  const demographics = QUESTIONS.filter((q) => q.section === "about").flatMap((q) =>
    q.stages.map((st) => categorical(q, st, byStage[st])),
  );
  const exposureQ = QUESTIONS.find((q) => q.id === "r_exposure");
  const exposureGroups = (["exposed", "notExposed"] as const).map((group) => {
    const members = byStage.post.filter((r) => {
      const picks = r.answers.get("r_exposure") ? pickedOptions(r.answers.get("r_exposure")!.value) : [];
      if (!picks.length || picks.includes("unsure")) return false;
      return group === "notExposed" ? picks.includes("none") : !picks.includes("none");
    });
    const ids = new Set(members.map((m) => m.id));
    const groupDiffs = pairs.filter((p) => ids.has(p.post.id)).map((p) => p.post.knowledgeScore - p.pre.knowledgeScore);
    return {
      group,
      n: members.length,
      mean: s.mean(members.map((m) => m.knowledgeScore)),
      pairedN: groupDiffs.length,
      meanChange: s.mean(groupDiffs),
    };
  });

  // --- Data quality ---------------------------------------------------------------
  const warnings: string[] = [];
  if (opts.includeDemo) warnings.push("Demonstration data is included. These are NOT real participants — do not report them.");
  for (const st of STAGES) {
    const n = byStage[st].length;
    if (n < TARGET_SAMPLE) {
      warnings.push(`${st.toUpperCase()} has ${n} response${n === 1 ? "" : "s"}, below the ${TARGET_SAMPLE}-participant minimum recommended in the brief.`);
    }
    const abandoned = overviewByStage[st].abandoned;
    if (abandoned > 0) warnings.push(`${abandoned} ${st.toUpperCase()} session${abandoned === 1 ? " was" : "s were"} started but not submitted.`);
  }
  if (pairs.length > 0 && pairs.length < 10) {
    warnings.push(`Only ${pairs.length} matched PRE/POST pair${pairs.length === 1 ? "" : "s"}: paired tests have very low power and should be treated as descriptive.`);
  }
  const unmatchedPost = byStage.post.length - pairs.length;
  if (unmatchedPost > 0) {
    warnings.push(`${unmatchedPost} POST response${unmatchedPost === 1 ? " has" : "s have"} no matching PRE code and ${unmatchedPost === 1 ? "is" : "are"} excluded from paired analysis.`);
  }
  const otherVersions = all.filter((r) => r.surveyVersion !== SURVEY_VERSION).length;
  if (otherVersions) warnings.push(`${otherVersions} response(s) were collected with an older survey version.`);

  const missingOptional = QUESTIONS.filter((q) => !q.required).flatMap((q) =>
    q.stages.map((st) => ({
      questionId: q.id,
      label: q.shortLabel,
      stage: st,
      missing: byStage[st].filter((r) => !r.answers.has(q.id)).length,
      of: byStage[st].length,
    })),
  );

  return {
    generatedAt: new Date().toISOString(),
    includesDemo: opts.includeDemo,
    demoResponsesInDatabase: demoResponseCount(db),
    survey: { version: SURVEY_VERSION, title: SURVEY_TITLE, knowledgeMax: KNOWLEDGE_MAX, knowledgeItemCount: KNOWLEDGE_ITEMS.length },
    overview: {
      totalResponses: all.length,
      byStage: overviewByStage,
      matchedPairs: pairs.length,
      unmatchedPost,
    },
    scores: { pre: scoreSummary(preScores), post: scoreSummary(postScores) },
    items,
    topMisconceptions,
    topics,
    comparison: {
      independent: {
        preN: preScores.length,
        postN: postScores.length,
        meanDiff: preMean !== null && postMean !== null ? postMean - preMean : null,
        welch: s.welchTTest(preScores, postScores),
        cohensD: s.cohensD(preScores, postScores),
      },
      paired,
    },
    selfAssessment: { pre: selfAssessment(byStage.pre), post: selfAssessment(byStage.post) },
    demographics,
    exposure: {
      stat: exposureQ ? categorical(exposureQ, "post", byStage.post) : null,
      postScoreByExposure: exposureGroups,
    },
    dataQuality: { warnings, missingOptional },
    caveats: CAVEATS,
  };
}
