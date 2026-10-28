// Dashboard sections. Each takes the live AnalyticsReport; nothing here is hard-coded data.

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type {
  AdminQuestionKey,
  AnalyticsReport,
  CategoricalStat,
  ChangeDirection,
  ItemAnalytics,
  Stage,
} from "../../../shared/types";
import { api, ApiRequestError } from "../api";
import { LikertChart, PairBars, ScoreHistogram, ShareBar, SlopeChart } from "./charts";
import { ci, duration, int, num, pct, pp, pval, signed, signedCi } from "./format";
import { IconChart, IconCheck, IconDownload } from "../components/icons";
import { IconChevronDown, IconTrendDown, IconTrendFlat, IconTrendUp } from "./icons";

const STAGE_LABEL: Record<Stage, string> = { pre: "PRE", post: "POST" };

// --- Building blocks ------------------------------------------------------------------

export function SectionHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="section-header">
      <h2 className="section-title">{title}</h2>
      {children && <div className="section-intro">{children}</div>}
    </header>
  );
}

function Panel({ title, aside, children, className = "" }: { title?: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      {(title || aside) && (
        <div className="panel__head">
          {title && <h3 className="h3">{title}</h3>}
          {aside && <div className="panel__aside">{aside}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

function Kpi({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="kpi">
      <div className="kpi__label">{label}</div>
      <div className="kpi__value tabular">{value}</div>
      {sub && <div className="kpi__sub">{sub}</div>}
    </div>
  );
}

function NotEnough({ children }: { children: ReactNode }) {
  return <p className="not-enough">{children}</p>;
}

function TableWrap({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="table-wrap" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}

const DIRECTION: Record<ChangeDirection, { cls: string; label: string; icon?: ReactNode }> = {
  improved: { cls: "pill--good", label: "Improved", icon: <IconTrendUp /> },
  declined: { cls: "pill--bad", label: "Declined", icon: <IconTrendDown /> },
  unchanged: { cls: "", label: "Unchanged", icon: <IconTrendFlat /> },
  insufficient: { cls: "pill--muted", label: "Too few responses" },
};

export function DirectionPill({ direction }: { direction: ChangeDirection }) {
  const d = DIRECTION[direction];
  return (
    <span className={`pill ${d.cls}`}>
      {d.icon}
      {d.label}
    </span>
  );
}

// --- Empty state ------------------------------------------------------------------------

export function EmptyState() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return (
    <div className="empty">
      <div className="empty__art" aria-hidden="true">
        <IconChart size={48} />
      </div>
      <h2 className="h2">No responses yet</h2>
      <p className="muted">
        As soon as participants submit the survey, results appear here automatically. Share these links to start collecting data.
      </p>
      <div className="link-list">
        <CopyLink label="PRE survey (before the campaign)" url={`${origin}/s/pre`} />
        <CopyLink label="POST survey (after the campaign)" url={`${origin}/s/post`} />
      </div>
    </div>
  );
}

function CopyLink({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: the link is still visible and selectable */
    }
  };
  return (
    <div className="copy-link">
      <div>
        <div className="copy-link__label">{label}</div>
        <a className="copy-link__url mono" href={url} target="_blank" rel="noreferrer">
          {url}
        </a>
      </div>
      <button type="button" className="btn btn--sm" onClick={copy} aria-live="polite">
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

// --- Overview -----------------------------------------------------------------------------

export function Overview({ r }: { r: AnalyticsReport }) {
  const o = r.overview;
  const max = r.survey.knowledgeMax;
  return (
    <>
      <SectionHeader title="Collection at a glance">
        Knowledge score is the sum of {r.survey.knowledgeItemCount} scenario items, out of {max}. Survey version {r.survey.version}.
      </SectionHeader>

      <div className="kpis">
        <Kpi label="Total responses" value={int(o.totalResponses)} sub={`${int(o.byStage.pre.completed)} PRE · ${int(o.byStage.post.completed)} POST`} />
        <Kpi
          label="PRE completion"
          value={pct(o.byStage.pre.completionRate)}
          sub={`${int(o.byStage.pre.completed)} of ${int(o.byStage.pre.started)} started`}
        />
        <Kpi
          label="POST completion"
          value={pct(o.byStage.post.completionRate)}
          sub={`${int(o.byStage.post.completed)} of ${int(o.byStage.post.started)} started`}
        />
        <Kpi label="Matched pairs" value={int(o.matchedPairs)} sub={`${int(o.unmatchedPost)} POST without a PRE match`} />
        <Kpi
          label="Median time"
          value={duration(o.byStage.pre.medianDurationSeconds)}
          sub={`PRE · POST ${duration(o.byStage.post.medianDurationSeconds)}`}
        />
      </div>

      {r.dataQuality.warnings.length > 0 && (
        <Panel title="Sample size & data quality" className="panel--warn">
          <ul className="warning-list">
            {r.dataQuality.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title="Knowledge scores">
        <TableWrap label="Knowledge score summary">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Stage</th>
                <th scope="col" className="num">n</th>
                <th scope="col" className="num">Mean</th>
                <th scope="col" className="num">95% CI</th>
                <th scope="col" className="num">Median</th>
                <th scope="col" className="num">IQR</th>
                <th scope="col" className="num">SD</th>
                <th scope="col" className="num">Range</th>
              </tr>
            </thead>
            <tbody>
              {(["pre", "post"] as Stage[]).map((st) => {
                const s = r.scores[st];
                return (
                  <tr key={st}>
                    <th scope="row">
                      <span className={`swatch swatch--${st}`} aria-hidden="true" /> {STAGE_LABEL[st]}
                    </th>
                    <td className="num">{s.n}</td>
                    <td className="num strong">{num(s.mean)}</td>
                    <td className="num">{ci(s.ci95)}</td>
                    <td className="num">{num(s.median)}</td>
                    <td className="num">{s.q1 !== null ? `${num(s.q1)} – ${num(s.q3)}` : "—"}</td>
                    <td className="num">{num(s.sd)}</td>
                    <td className="num">{s.min !== null ? `${num(s.min, 1)} – ${num(s.max, 1)}` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      </Panel>

      <Panel title="Score distribution" aside={<span className="muted small">Share of each stage's responses, so groups of different size compare fairly</span>}>
        {r.scores.pre.n + r.scores.post.n > 0 ? (
          <ScoreHistogram pre={r.scores.pre.histogram} post={r.scores.post.histogram} max={max} />
        ) : (
          <NotEnough>No scores yet.</NotEnough>
        )}
      </Panel>
    </>
  );
}

// --- PRE vs POST -------------------------------------------------------------------------------

export function Comparison({ r }: { r: AnalyticsReport }) {
  const p = r.comparison.paired;
  const ind = r.comparison.independent;
  return (
    <>
      <SectionHeader title="What changed — and what we can claim">
        Paired results use only participants whose anonymous code appears in both surveys. They are the primary comparison.
      </SectionHeader>

      <aside className="interpret" aria-labelledby="interpret-title">
        <h3 id="interpret-title" className="h3">
          Interpreting these results
        </h3>
        <p className="interpret__lead">
          These figures show <strong>observed change</strong>, not proof that the campaign caused it. A higher POST score is consistent with
          the campaign working, but other explanations cannot be ruled out without a control group.
        </p>
        <ul>
          {r.caveats.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </aside>

      <Panel title="Paired comparison" aside={<span className="pill">n = {p.n} pairs</span>}>
        {p.n === 0 ? (
          <NotEnough>
            No matched pairs yet. A pair appears when someone completes the POST survey with the same code they received in PRE.
          </NotEnough>
        ) : (
          <div className="paired">
            <div className="paired__hero">
              <div className="paired__scores tabular">
                <span className="paired__pre">{num(p.meanPre)}</span>
                <span className="paired__arrow" aria-hidden="true">
                  →
                </span>
                <span className="paired__post">{num(p.meanPost)}</span>
              </div>
              <p className="muted small">Mean score, PRE → POST (out of {r.survey.knowledgeMax})</p>
              <dl className="stat-list">
                <div>
                  <dt>Mean change</dt>
                  <dd className="tabular">{signed(p.meanChange)}</dd>
                </div>
                <div>
                  <dt>95% CI of change</dt>
                  <dd className="tabular">{signedCi(p.ci95)}</dd>
                </div>
                <div>
                  <dt>SD of change</dt>
                  <dd className="tabular">{num(p.sdChange)}</dd>
                </div>
                <div>
                  <dt>Paired t-test</dt>
                  <dd className="tabular">
                    {p.tTest ? `t(${p.tTest.df}) = ${num(p.tTest.statistic)}, p ${fmtP(p.tTest.p)}` : "Not computed (needs ≥ 3 pairs with varying change)"}
                  </dd>
                </div>
                <div>
                  <dt>Wilcoxon signed-rank</dt>
                  <dd className="tabular">
                    {p.wilcoxon
                      ? `W+ = ${num(p.wilcoxon.statistic, 1)}, p ${fmtP(p.wilcoxon.p)} (${p.wilcoxon.nNonZero} non-zero)`
                      : "Not computed (needs ≥ 5 non-zero changes)"}
                  </dd>
                </div>
                <div>
                  <dt>Effect size (Cohen's d_z)</dt>
                  <dd className="tabular">{num(p.cohensDz)}</dd>
                </div>
              </dl>
              <div className="split-bar" role="img" aria-label={`${p.improved} improved, ${p.unchanged} unchanged, ${p.declined} declined`}>
                {(
                  [
                    ["up", p.improved, "Improved"],
                    ["flat", p.unchanged, "Unchanged"],
                    ["down", p.declined, "Declined"],
                  ] as const
                ).map(([k, v, label]) =>
                  v > 0 ? <span key={k} className={`split-bar__seg split-bar__seg--${k}`} style={{ flexGrow: v }} title={`${label}: ${v}`} /> : null,
                )}
              </div>
              <ul className="split-legend">
                <li>
                  <span className="swatch swatch--line-up" aria-hidden="true" /> {p.improved} improved
                </li>
                <li>
                  <span className="swatch swatch--line-flat" aria-hidden="true" /> {p.unchanged} unchanged
                </li>
                <li>
                  <span className="swatch swatch--line-down" aria-hidden="true" /> {p.declined} declined
                </li>
              </ul>
            </div>
            <div className="paired__chart">
              <SlopeChart pairs={p.pairs} max={r.survey.knowledgeMax} />
            </div>
          </div>
        )}
        {p.n > 0 && p.n < 10 && <p className="note">With fewer than 10 pairs, treat the tests as descriptive only.</p>}
      </Panel>

      <Panel title="Context: all PRE vs all POST responses" aside={<span className="pill pill--muted">Context only</span>}>
        <p className="muted small">
          Treats the two stages as independent groups even though many respondents are the same people, and includes unmatched responses. Useful
          as a sanity check; report the paired results as the main finding.
        </p>
        <dl className="stat-list stat-list--row">
          <div>
            <dt>n (PRE / POST)</dt>
            <dd className="tabular">
              {ind.preN} / {ind.postN}
            </dd>
          </div>
          <div>
            <dt>Difference in means</dt>
            <dd className="tabular">{signed(ind.meanDiff)}</dd>
          </div>
          <div>
            <dt>Welch t-test</dt>
            <dd className="tabular">{ind.welch ? `t(${num(ind.welch.df, 1)}) = ${num(ind.welch.statistic)}, p ${fmtP(ind.welch.p)}` : "Not computed"}</dd>
          </div>
          <div>
            <dt>Cohen's d</dt>
            <dd className="tabular">{num(ind.cohensD)}</dd>
          </div>
        </dl>
      </Panel>
    </>
  );
}

const fmtP = (p: number) => (p < 0.001 ? "< .001" : `= ${pval(p)}`);

// --- Questions -----------------------------------------------------------------------------------

export function Questions({ r, expandAll }: { r: AnalyticsReport; expandAll: boolean }) {
  return (
    <>
      <SectionHeader title="Where awareness is strong, weak and shifting">
        Accuracy is the mean item score (the share answering correctly; the multi-select item uses partial credit). “Observed” labels are descriptive:
        a change of at least 10 percentage points with five or more responses per stage. They are not significance tests.
      </SectionHeader>

      <Panel title="By topic">
        <div className="topic-grid">
          {r.topics.map((t) => (
            <div className="topic" key={t.topic}>
              <div className="topic__head">
                <span className="topic__label">{t.label}</span>
                <span className="muted tiny">
                  {t.itemIds.length} item{t.itemIds.length === 1 ? "" : "s"}
                </span>
              </div>
              <PairBars pre={t.byStage.pre.accuracy} post={t.byStage.post.accuracy} label={t.label} />
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Item by item" aside={<span className="muted small">Select a question to see every answer option</span>}>
        <div className="items">
          {r.items.map((item) => (
            <ItemRow key={item.id} item={item} expandAll={expandAll} />
          ))}
        </div>
      </Panel>

      <Panel title="Most common misconceptions">
        {r.topMisconceptions.length === 0 ? (
          <NotEnough>None recorded yet.</NotEnough>
        ) : (
          <ol className="misconceptions">
            {r.topMisconceptions.map((m) => (
              <li key={`${m.itemId}-${m.optionLabel}-${m.stage}`}>
                <div className="misconceptions__share tabular">{pct(m.share)}</div>
                <div>
                  <div className="misconceptions__text">{m.misconception}</div>
                  <div className="muted small">
                    Q{m.itemNumber} {m.shortLabel} · chose “{m.optionLabel}” · {m.count} {STAGE_LABEL[m.stage]} respondent{m.count === 1 ? "" : "s"}
                  </div>
                </div>
                <span className={`pill ${m.stage === "post" ? "pill--post" : "pill--pre"}`}>{STAGE_LABEL[m.stage]}</span>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </>
  );
}

function ItemRow({ item, expandAll }: { item: ItemAnalytics; expandAll: boolean }) {
  const [open, setOpen] = useState(false);
  const isOpen = open || expandAll;
  const { pre, post } = item.byStage;
  return (
    <details className="item" open={isOpen} onToggle={(e) => !expandAll && setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="item__summary">
        <span className="item__num tabular">Q{item.number}</span>
        <span className="item__title">
          <span className="item__label">{item.shortLabel}</span>
          <span className="muted tiny">{item.topicLabel}</span>
        </span>
        <span className="item__bars">
          <PairBars pre={pre.accuracy} post={post.accuracy} label={`Q${item.number} accuracy`} />
        </span>
        <span className="item__change">
          <span className="tabular strong">{pp(item.change.accuracyDelta)}</span>
          <DirectionPill direction={item.change.direction} />
        </span>
        <span className="item__chev" aria-hidden="true">
          <IconChevronDown size={18} />
        </span>
      </summary>
      <div className="item__body">
        <p className="item__prompt">{item.prompt}</p>
        <dl className="stat-list stat-list--row stat-list--compact">
          <div>
            <dt>n (PRE / POST)</dt>
            <dd className="tabular">
              {pre.n} / {post.n}
            </dd>
          </div>
          <div>
            <dt>“Not sure” rate</dt>
            <dd className="tabular">
              {pct(pre.unsureRate)} → {pct(post.unsureRate)}
            </dd>
          </div>
          <div>
            <dt>Paired: became correct / became wrong</dt>
            <dd className="tabular">
              {item.paired.n ? `${item.paired.improved} improved / ${item.paired.declined} declined of ${item.paired.n}` : "No pairs"}
            </dd>
          </div>
          <div>
            <dt>McNemar exact p</dt>
            <dd className="tabular">{pval(item.paired.mcnemarP)}</dd>
          </div>
        </dl>
        <TableWrap label={`Answer options for Q${item.number}`}>
          <table className="data-table options-table">
            <thead>
              <tr>
                <th scope="col">Option</th>
                <th scope="col" className="bar-col">
                  PRE
                </th>
                <th scope="col" className="bar-col">
                  POST
                </th>
              </tr>
            </thead>
            <tbody>
              {pre.options.map((o, i) => {
                const po = post.options[i];
                return (
                  <tr key={o.id} className={o.isCorrect ? "is-correct" : ""}>
                    <th scope="row">
                      <div className="opt-label">
                        {o.isCorrect ? (
                          <span className="pill pill--good pill--xs">Correct</span>
                        ) : o.id === "unsure" ? (
                          <span className="pill pill--muted pill--xs">Unsure</span>
                        ) : null}
                        <span>{o.label}</span>
                      </div>
                      {o.misconception && <div className="opt-misconception">Misconception: {o.misconception}</div>}
                    </th>
                    <td className="bar-col">
                      <span className="opt-share">
                        <ShareBar value={o.share} tone="pre" label={`PRE ${pct(o.share)}`} />
                        <span className="tabular">
                          {pct(o.share)} <span className="muted">({o.count})</span>
                        </span>
                      </span>
                    </td>
                    <td className="bar-col">
                      <span className="opt-share">
                        <ShareBar value={po.share} tone="post" label={`POST ${pct(po.share)}`} />
                        <span className="tabular">
                          {pct(po.share)} <span className="muted">({po.count})</span>
                        </span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
        {item.kind === "multi" && <p className="note">Multi-select: shares can add up to more than 100%.</p>}
      </div>
    </details>
  );
}

// --- Perception ------------------------------------------------------------------------------------

const LIKERT = ["Not at all", "Slightly", "Moderately", "Very", "Extremely"];

export function Perception({ r }: { r: AnalyticsReport }) {
  const sa = r.selfAssessment;
  const rows: [string, (st: Stage) => string, string?][] = [
    ["Respondents", (st) => int(sa[st].n)],
    ["Confidence (1–5)", (st) => num(sa[st].confidenceMean), "How confident people feel about spotting phishing, asked before the scenarios."],
    ["Estimated items correct", (st) => num(sa[st].estimateMean), "Their own guess after answering, out of 10."],
    ["Actual items correct", (st) => num(sa[st].actualCorrectMean), "Items answered fully correctly."],
    ["Calibration (estimate − actual)", (st) => signed(sa[st].calibrationMean), "Positive means people overestimate their performance."],
    ["Confidence ↔ score (Spearman ρ)", (st) => num(sa[st].confidenceScoreRho), "Near 0: feeling confident tells you little about actual skill."],
  ];
  return (
    <>
      <SectionHeader title="Perceived vs demonstrated awareness">
        Self-ratings are kept separate from the knowledge score so the two can be compared. Overconfidence matters: people who think they can't
        be fooled tend to check less.
      </SectionHeader>

      <Panel title="Summary">
        <TableWrap label="Self-assessment summary">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Measure</th>
                <th scope="col" className="num">
                  PRE
                </th>
                <th scope="col" className="num">
                  POST
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, f, help]) => (
                <tr key={label}>
                  <th scope="row">
                    <div>{label}</div>
                    {help && <div className="muted tiny">{help}</div>}
                  </th>
                  <td className="num strong">{f("pre")}</td>
                  <td className="num strong">{f("post")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
        <p className="note">
          <strong>Calibration, in plain words:</strong> if people say they got 8 of 10 right but actually got 5, their calibration is +3 — they feel
          safer than their answers suggest. A value near 0 means self-assessment matches reality.
        </p>
      </Panel>

      <Panel title="Confidence ratings">
        {sa.pre.n + sa.post.n > 0 ? (
          <LikertChart pre={sa.pre.confidenceDistribution} post={sa.post.confidenceDistribution} labels={LIKERT} />
        ) : (
          <NotEnough>No ratings yet.</NotEnough>
        )}
      </Panel>
    </>
  );
}

// --- Sample ----------------------------------------------------------------------------------------

export function Sample({ r }: { r: AnalyticsReport }) {
  return (
    <>
      <SectionHeader title="Who took part">
        Background questions were optional and asked only in PRE. Mean score is the average PRE knowledge score of respondents who chose that
        option — descriptive only; small groups are unreliable.
      </SectionHeader>

      <div className="two-col">
        {r.demographics.map((d) => (
          <Panel key={`${d.questionId}-${d.stage}`} title={d.label} aside={<span className="muted small">{d.answered} answered · {d.skipped} skipped</span>}>
            <CategoricalTable stat={d} showMean />
          </Panel>
        ))}
      </div>

      {r.exposure.stat && (
        <Panel title="Campaign exposure (POST)" aside={<span className="muted small">{r.exposure.stat.answered} answered</span>}>
          <CategoricalTable stat={r.exposure.stat} showMean multi />
          <div className="exposure-groups">
            {r.exposure.postScoreByExposure.map((g) => (
              <div className="exposure-group" key={g.group}>
                <div className="kpi__label">{g.group === "exposed" ? "Saw at least one campaign element" : "Saw none of the campaign"}</div>
                <div className="exposure-group__nums tabular">
                  <span>
                    <strong>{num(g.mean)}</strong> mean POST score <span className="muted">(n = {g.n})</span>
                  </span>
                  <span>
                    <strong>{signed(g.meanChange)}</strong> mean paired change <span className="muted">(n = {g.pairedN})</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="note">
            Exposure is self-reported and was not randomly assigned, so people who engaged with the campaign may differ in other ways. Differences
            between these groups are not evidence that the campaign caused them.
          </p>
        </Panel>
      )}

      <Panel title="Missing optional answers">
        <TableWrap label="Missing optional answers">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Question</th>
                <th scope="col">Stage</th>
                <th scope="col" className="num">
                  Missing
                </th>
                <th scope="col" className="num">
                  Of
                </th>
                <th scope="col" className="num">
                  Rate
                </th>
              </tr>
            </thead>
            <tbody>
              {r.dataQuality.missingOptional.map((m) => (
                <tr key={`${m.questionId}-${m.stage}`}>
                  <th scope="row">{m.label}</th>
                  <td>{STAGE_LABEL[m.stage]}</td>
                  <td className="num">{m.missing}</td>
                  <td className="num">{m.of}</td>
                  <td className="num">{m.of ? pct(m.missing / m.of) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
        <p className="note">All scored questions and self-ratings are required, so they have no missing values in submitted responses.</p>
      </Panel>
    </>
  );
}

function CategoricalTable({ stat, showMean, multi }: { stat: CategoricalStat; showMean?: boolean; multi?: boolean }) {
  const total = stat.answered;
  return (
    <TableWrap label={stat.label}>
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Answer</th>
            <th scope="col" className="bar-col">
              Share
            </th>
            <th scope="col" className="num">
              n
            </th>
            {showMean && (
              <th scope="col" className="num">
                Mean score
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {stat.options.map((o) => {
            const share = total ? o.count / total : 0;
            return (
              <tr key={o.id}>
                <th scope="row">{o.label}</th>
                <td className="bar-col">
                  <span className="opt-share">
                    <ShareBar value={share} label={pct(share)} />
                    <span className="tabular">{pct(share)}</span>
                  </span>
                </td>
                <td className="num">{o.count}</td>
                {showMean && <td className="num">{num(o.meanScore)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
      {multi && <p className="note">Multiple answers allowed: shares can add up to more than 100%.</p>}
    </TableWrap>
  );
}

// --- Exports ---------------------------------------------------------------------------------------

export function Exports({ includeDemo, demoInstance }: { includeDemo: boolean; demoInstance?: boolean }) {
  const q = includeDemo ? "?includeDemo=1" : "";
  const files = [
    {
      href: `/api/admin/export/responses.csv${q}`,
      title: "Responses (CSV)",
      desc: "One row per submitted response: stage, anonymous code, scores, timing, and every answer with its item score.",
    },
    {
      href: `/api/admin/export/items.csv${q}`,
      title: "Item summary (CSV)",
      desc: "One row per scenario question: PRE/POST accuracy, change, paired counts and McNemar p.",
    },
    {
      href: `/api/admin/export/summary.md${q}`,
      title: "Report summary (Markdown)",
      desc: "Ready-to-paste tables and caveats for the written report.",
    },
    {
      href: `/api/admin/export/codebook.csv`,
      title: "Codebook (CSV)",
      desc: "Every question and option id with its wording, correct answers and misconception labels.",
    },
  ];
  return (
    <>
      <SectionHeader title="Download the data">
        Exports are generated from the database at the moment you click.{" "}
        {demoInstance ? (
          <strong className="demo-text">
            This is the demonstration instance: every file contains synthetic data and is named -DEMO-INSTANCE.
          </strong>
        ) : includeDemo ? (
          <strong className="demo-text">Demonstration data is currently INCLUDED and files are named accordingly.</strong>
        ) : (
          "Rows flagged as demonstration data are excluded."
        )}
      </SectionHeader>
      <div className="export-grid">
        {files.map((f) => (
          <a key={f.href} className="export" href={f.href} download>
            <span className="export__icon" aria-hidden="true">
              <IconDownload size={18} />
            </span>
            <span>
              <span className="export__title">{f.title}</span>
              <span className="export__desc">{f.desc}</span>
            </span>
          </a>
        ))}
      </div>
      <p className="note">
        The responses file contains anonymous participant codes but no names, emails or IP addresses. Store downloaded files securely and delete
        them when the project ends.
      </p>
    </>
  );
}

// --- Answer key ------------------------------------------------------------------------------------

export function AnswerKey({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [key, setKey] = useState<AdminQuestionKey[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<AdminQuestionKey[]>("/admin/answer-key")
      .then(setKey)
      .catch((e: unknown) => {
        if (e instanceof ApiRequestError && e.status === 401) onUnauthorized();
        else setError(e instanceof Error ? e.message : "Could not load the answer key.");
      });
  }, [onUnauthorized]);

  return (
    <>
      <SectionHeader title="Questions, correct answers and rationale">
        For the team only. Participants never receive this. Only the ten scenario items are scored.
      </SectionHeader>
      {error && <div className="notice notice--bad">{error}</div>}
      {!key && !error && <div className="skeleton" aria-busy="true" />}
      {key && (
        <ol className="key-list">
          {key.map((q) => (
            <li key={q.id} className="key">
              <div className="key__head">
                <span className="item__num tabular">{q.number ? `Q${q.number}` : "—"}</span>
                <div>
                  <div className="key__prompt">{q.prompt}</div>
                  <div className="row tiny muted key__meta">
                    <span className="mono">{q.id}</span>
                    <span>·</span>
                    <span>{q.kind}</span>
                    <span>·</span>
                    <span>{q.stages.map((s) => STAGE_LABEL[s]).join(" + ")}</span>
                    {!q.number && <span className="pill pill--muted pill--xs">Not scored</span>}
                  </div>
                </div>
              </div>
              {q.options.length > 0 && (
                <ul className="key__options">
                  {q.options.map((o) => (
                    <li key={o.id} className={o.isCorrect ? "is-correct" : ""}>
                      <span className="key__marker" aria-hidden="true">
                        {o.isCorrect ? <IconCheck size={16} label="Correct" /> : null}
                      </span>
                      <span>
                        <span className={o.mono ? "mono" : ""}>{o.label}</span>
                        {o.isCorrect && <span className="sr-only"> (correct)</span>}
                        {o.misconception && <span className="key__misc">{o.misconception}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {q.rationale && (
                <p className="key__rationale">
                  <strong>Why:</strong> {q.rationale}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

// --- Withdraw --------------------------------------------------------------------------------------

export function Withdraw({ onDone, onUnauthorized }: { onDone: () => void; onUnauthorized: () => void }) {
  const [code, setCode] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    if (!confirming) {
      setConfirming(true);
      setResult(null);
      return;
    }
    setBusy(true);
    try {
      const res = await api<{ responses: number; sessions: number }>("/admin/withdraw", {
        method: "POST",
        json: { participantCode: code.trim() },
      });
      setResult({
        ok: true,
        text:
          res.responses + res.sessions === 0
            ? "No data was stored under that code."
            : `Removed ${res.responses} response${res.responses === 1 ? "" : "s"} and ${res.sessions} session${res.sessions === 1 ? "" : "s"}.`,
      });
      setCode("");
      onDone();
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 401) return onUnauthorized();
      setResult({ ok: false, text: err instanceof Error ? err.message : "Withdrawal failed." });
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <>
      <SectionHeader title="Remove a participant's data">
        If a participant asks to withdraw, they send you their anonymous code. This permanently deletes every PRE and POST response stored under
        it. It cannot be undone.
      </SectionHeader>
      <form className="panel withdraw" onSubmit={submit}>
        <div className="field">
          <label htmlFor="withdraw-code">Participant code</label>
          <input
            id="withdraw-code"
            className="input input--code"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setConfirming(false);
            }}
            placeholder="XXXX-XXXX"
            autoComplete="off"
            spellCheck={false}
            maxLength={16}
          />
        </div>
        {confirming && (
          <div className="notice notice--bad" role="alert">
            Permanently delete all data for <strong className="mono">{code.trim().toUpperCase()}</strong>? Press the button again to confirm.
          </div>
        )}
        <div className="row">
          <button type="submit" className={`btn ${confirming ? "btn--danger" : ""}`} disabled={!code.trim() || busy}>
            {busy ? <span className="spinner" aria-hidden="true" /> : null}
            {confirming ? "Yes, delete permanently" : "Remove data"}
          </button>
          {confirming && (
            <button type="button" className="btn btn--ghost" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          )}
        </div>
        {result && (
          <div className={`notice ${result.ok ? "notice--good" : "notice--bad"}`} role="status">
            {result.text}
          </div>
        )}
      </form>
    </>
  );
}
