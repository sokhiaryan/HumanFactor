// CSV and Markdown exports for the project report.

import type { AnalyticsReport, Stage } from "../shared/types.js";
import type { StoredResponse } from "./db.js";
import { QUESTIONS } from "./survey/definition.js";

type Cell = string | number | boolean | null | undefined;

/** RFC 4180 quoting plus protection against spreadsheet formula injection. */
export function csvCell(v: Cell): string {
  if (v === null || v === undefined) return "";
  let str = typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(3)) : String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(str)) str = `'${str}`;
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function toCsv(header: string[], rows: Cell[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** One row per submitted response; one column per question (+ a score column per knowledge item). */
export function responsesCsv(responses: StoredResponse[]): string {
  const codesByStage: Record<Stage, Set<string>> = { pre: new Set(), post: new Set() };
  for (const r of responses) if (r.participantCode) codesByStage[r.stage].add(r.participantCode);

  const header = [
    "response_id",
    "stage",
    "participant_code",
    "matched_pre_post",
    "survey_version",
    "submitted_at",
    "duration_seconds",
    "knowledge_score",
    "knowledge_max",
    "knowledge_pct",
    "items_fully_correct",
    "confidence_1to5",
    "estimated_correct",
    "calibration_estimate_minus_actual",
    "is_demo",
  ];
  for (const q of QUESTIONS) {
    header.push(q.id);
    if (q.key) header.push(`${q.id}__score`);
  }

  const rows = responses.map((r) => {
    const other: Stage = r.stage === "pre" ? "post" : "pre";
    const row: Cell[] = [
      r.id,
      r.stage,
      r.participantCode,
      r.participantCode ? codesByStage[other].has(r.participantCode) : false,
      r.surveyVersion,
      r.submittedAt,
      r.durationSeconds,
      r.knowledgeScore,
      r.knowledgeMax,
      Math.round((r.knowledgeScore / r.knowledgeMax) * 1000) / 10,
      r.fullyCorrect,
      r.confidence,
      r.estimatedCorrect,
      r.estimatedCorrect !== null ? r.estimatedCorrect - r.fullyCorrect : null,
      r.isDemo,
    ];
    for (const q of QUESTIONS) {
      const a = r.answers.get(q.id);
      row.push(a ? (Array.isArray(a.value) ? a.value.join(";") : a.value) : null);
      if (q.key) row.push(a?.score ?? null);
    }
    return row;
  });
  return toCsv(header, rows);
}

/** Item-level aggregate table (one row per knowledge item). */
export function itemsCsv(report: AnalyticsReport): string {
  const header = [
    "item",
    "question_id",
    "short_label",
    "topic",
    "pre_n",
    "pre_accuracy",
    "pre_unsure_rate",
    "post_n",
    "post_accuracy",
    "post_unsure_rate",
    "accuracy_change",
    "direction",
    "paired_n",
    "paired_improved",
    "paired_declined",
    "paired_stayed_correct",
    "paired_stayed_incorrect",
    "mcnemar_p",
  ];
  const rows = report.items.map((i) => [
    i.number,
    i.id,
    i.shortLabel,
    i.topicLabel,
    i.byStage.pre.n,
    i.byStage.pre.accuracy,
    i.byStage.pre.unsureRate,
    i.byStage.post.n,
    i.byStage.post.accuracy,
    i.byStage.post.unsureRate,
    i.change.accuracyDelta,
    i.change.direction,
    i.paired.n,
    i.paired.improved,
    i.paired.declined,
    i.paired.stayedCorrect,
    i.paired.stayedIncorrect,
    i.paired.mcnemarP,
  ]);
  return toCsv(header, rows);
}

/** Codebook: every question and option id with its label, correctness and misconception. */
export function codebookCsv(): string {
  const header = ["question_id", "stages", "kind", "required", "prompt", "option_id", "option_label", "is_correct", "misconception"];
  const rows: Cell[][] = [];
  for (const q of QUESTIONS) {
    if (q.options) {
      for (const o of q.options) {
        rows.push([
          q.id,
          q.stages.join("+"),
          q.kind,
          q.required,
          q.prompt,
          o.id,
          o.label,
          q.key ? q.key.correct.includes(o.id) : null,
          q.key?.misconceptions[o.id] ?? null,
        ]);
      }
    } else {
      rows.push([q.id, q.stages.join("+"), q.kind, q.required, q.prompt, `${q.scale!.min}..${q.scale!.max}`, `${q.scale!.minLabel} → ${q.scale!.maxLabel}`, null, null]);
    }
  }
  return toCsv(header, rows);
}

// --- Markdown summary -------------------------------------------------------------

const f = (x: number | null | undefined, d = 2) => (x === null || x === undefined || Number.isNaN(x) ? "—" : x.toFixed(d));
const pct = (x: number | null | undefined) => (x === null || x === undefined ? "—" : `${Math.round(x * 100)}%`);
const signed = (x: number | null | undefined, d = 2) => (x === null || x === undefined ? "—" : `${x > 0 ? "+" : ""}${x.toFixed(d)}`);
const pval = (p: number | null | undefined) => (p === null || p === undefined ? "—" : p < 0.001 ? "< .001" : p.toFixed(3));

export function summaryMarkdown(r: AnalyticsReport): string {
  const L: string[] = [];
  const max = r.survey.knowledgeMax;
  L.push(`# ${r.survey.title} — results summary`);
  L.push("");
  L.push(`Generated ${r.generatedAt} · survey version ${r.survey.version} · knowledge score out of ${max}`);
  if (r.includesDemo) {
    L.push("");
    L.push("> **⚠ DEMONSTRATION DATA INCLUDED — these figures are not real participant results and must not be reported.**");
  }
  L.push("");
  L.push("## Sample");
  L.push("");
  L.push("| | PRE | POST |");
  L.push("|---|---|---|");
  const o = r.overview.byStage;
  L.push(`| Sessions started | ${o.pre.started} | ${o.post.started} |`);
  L.push(`| Responses submitted | ${o.pre.completed} | ${o.post.completed} |`);
  L.push(`| Completion rate | ${pct(o.pre.completionRate)} | ${pct(o.post.completionRate)} |`);
  L.push(`| Median time to complete | ${o.pre.medianDurationSeconds !== null ? `${Math.round(o.pre.medianDurationSeconds / 60)} min` : "—"} | ${o.post.medianDurationSeconds !== null ? `${Math.round(o.post.medianDurationSeconds / 60)} min` : "—"} |`);
  L.push("");
  L.push(`Matched PRE/POST pairs (same anonymous code): **${r.overview.matchedPairs}**. Unmatched POST responses: ${r.overview.unmatchedPost}.`);
  L.push("");
  L.push("## Knowledge scores");
  L.push("");
  L.push("| | n | Mean | 95% CI | Median | SD | Range |");
  L.push("|---|---|---|---|---|---|---|");
  for (const st of ["pre", "post"] as const) {
    const sc = r.scores[st];
    L.push(
      `| ${st.toUpperCase()} | ${sc.n} | ${f(sc.mean)} | ${sc.ci95 ? `${f(sc.ci95[0])}–${f(sc.ci95[1])}` : "—"} | ${f(sc.median)} | ${f(sc.sd)} | ${sc.min !== null ? `${f(sc.min, 1)}–${f(sc.max, 1)}` : "—"} |`,
    );
  }
  L.push("");
  const p = r.comparison.paired;
  L.push("### Paired comparison (matched participants)");
  L.push("");
  if (p.n === 0) {
    L.push("No matched pairs yet.");
  } else {
    L.push(`- n = ${p.n} pairs; mean PRE ${f(p.meanPre)} → mean POST ${f(p.meanPost)}; mean change ${signed(p.meanChange)} (95% CI ${p.ci95 ? `${signed(p.ci95[0])} to ${signed(p.ci95[1])}` : "—"}).`);
    L.push(`- ${p.improved} improved, ${p.unchanged} unchanged, ${p.declined} declined.`);
    L.push(`- Paired t-test: ${p.tTest ? `t(${p.tTest.df}) = ${f(p.tTest.statistic)}, p = ${pval(p.tTest.p)}` : "not computed (too few pairs or no variation)"}; Cohen's d_z = ${f(p.cohensDz)}.`);
    L.push(`- Wilcoxon signed-rank: ${p.wilcoxon ? `W+ = ${f(p.wilcoxon.statistic, 1)}, p = ${pval(p.wilcoxon.p)} (${p.wilcoxon.nNonZero} non-zero changes)` : "not computed (fewer than 5 non-zero changes)"}.`);
  }
  L.push("");
  const ind = r.comparison.independent;
  L.push(`Independent-groups context (all PRE vs all POST): difference ${signed(ind.meanDiff)}, Welch ${ind.welch ? `t(${f(ind.welch.df, 1)}) = ${f(ind.welch.statistic)}, p = ${pval(ind.welch.p)}` : "not computed"}, Cohen's d = ${f(ind.cohensD)}.`);
  L.push("");
  L.push("## Item-level accuracy");
  L.push("");
  L.push("| # | Item | Topic | PRE | POST | Change | Observed | Paired ↑/↓ | McNemar p |");
  L.push("|---|---|---|---|---|---|---|---|---|");
  for (const i of r.items) {
    L.push(
      `| ${i.number} | ${i.shortLabel} | ${i.topicLabel} | ${pct(i.byStage.pre.accuracy)} | ${pct(i.byStage.post.accuracy)} | ${i.change.accuracyDelta !== null ? `${signed(i.change.accuracyDelta * 100, 0)} pp` : "—"} | ${i.change.direction} | ${i.paired.improved}/${i.paired.declined} | ${pval(i.paired.mcnemarP)} |`,
    );
  }
  L.push("");
  L.push(`“Observed” is descriptive: a change of at least 10 percentage points with ≥ 5 responses per stage; it is not a significance test.`);
  L.push("");
  L.push("## Topics");
  L.push("");
  L.push("| Topic | PRE | POST |");
  L.push("|---|---|---|");
  for (const t of r.topics) L.push(`| ${t.label} | ${pct(t.byStage.pre.accuracy)} | ${pct(t.byStage.post.accuracy)} |`);
  L.push("");
  L.push("## Most common misconceptions");
  L.push("");
  if (!r.topMisconceptions.length) L.push("None recorded yet.");
  for (const m of r.topMisconceptions) {
    L.push(`- **${pct(m.share)}** of ${m.stage.toUpperCase()} respondents — Q${m.itemNumber} ${m.shortLabel}: ${m.misconception} (chose “${m.optionLabel}”).`);
  }
  L.push("");
  L.push("## Perceived vs demonstrated awareness");
  L.push("");
  L.push("| | Confidence (1–5) | Estimated correct | Actually correct | Calibration | ρ(confidence, score) |");
  L.push("|---|---|---|---|---|---|");
  for (const st of ["pre", "post"] as const) {
    const sa = r.selfAssessment[st];
    L.push(`| ${st.toUpperCase()} | ${f(sa.confidenceMean)} | ${f(sa.estimateMean)} | ${f(sa.actualCorrectMean)} | ${signed(sa.calibrationMean)} | ${f(sa.confidenceScoreRho)} |`);
  }
  L.push("");
  L.push("Calibration = estimated − actual number of fully correct items (positive = overestimates own performance).");
  L.push("");
  if (r.exposure.stat) {
    L.push("## Campaign exposure (POST)");
    L.push("");
    for (const opt of r.exposure.stat.options) L.push(`- ${opt.label}: ${opt.count}`);
    for (const g of r.exposure.postScoreByExposure) {
      L.push(`- ${g.group === "exposed" ? "Saw ≥ 1 campaign element" : "Saw none"}: n = ${g.n}, mean POST score ${f(g.mean)}; paired n = ${g.pairedN}, mean change ${signed(g.meanChange)}.`);
    }
    L.push("");
    L.push("Exposure is self-reported and not randomised; differences between these groups are not evidence of a causal effect.");
    L.push("");
  }
  L.push("## Data quality");
  L.push("");
  if (!r.dataQuality.warnings.length) L.push("No warnings.");
  for (const w of r.dataQuality.warnings) L.push(`- ${w}`);
  L.push("");
  L.push("## Interpretation caveats");
  L.push("");
  for (const c of r.caveats) L.push(`- ${c}`);
  L.push("");
  return L.join("\n");
}
