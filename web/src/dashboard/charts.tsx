// Hand-rolled, dependency-free charts. Conventions (see the dataviz guidance):
// PRE = --series-pre (warm), POST = --series-post (accent); thin marks with 4px rounded
// data ends anchored to the baseline; recessive grid; a legend whenever two series are
// shown; every chart has role="img" + an aria-label summary, a hover tooltip and a
// table view (rendered visually-hidden, or visibly by the caller).

import { useRef, useState, type ReactNode } from "react";
import { pct } from "./format";

export type Series = "pre" | "post";
export const SERIES_LABEL: Record<Series, string> = { pre: "PRE", post: "POST" };

export function Legend({ items = ["pre", "post"] as Series[], labels }: { items?: Series[]; labels?: Partial<Record<Series, string>> }) {
  return (
    <ul className="legend" aria-label="Legend">
      {items.map((s) => (
        <li key={s}>
          <span className={`swatch swatch--${s}`} aria-hidden="true" />
          {labels?.[s] ?? SERIES_LABEL[s]}
        </li>
      ))}
    </ul>
  );
}

// --- Tooltip ----------------------------------------------------------------------

interface Tip {
  x: number;
  y: number;
  content: ReactNode;
}

function useTooltip() {
  const ref = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const show = (e: { clientX: number; clientY: number }, content: ReactNode) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    setTip({ x: e.clientX - box.left, y: e.clientY - box.top, content });
  };
  /** Keyboard focus: anchor the tooltip to the focused element's centre. */
  const showAt = (el: Element, content: ReactNode) => {
    const box = ref.current?.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (!box) return;
    setTip({ x: r.left + r.width / 2 - box.left, y: r.top - box.top, content });
  };
  const hide = () => setTip(null);
  const node = tip ? (
    <div
      className="chart-tip"
      role="status"
      style={{
        left: Math.max(8, Math.min(tip.x, (ref.current?.clientWidth ?? 0) - 8)),
        top: tip.y,
      }}
    >
      {tip.content}
    </div>
  ) : null;
  return { ref, show, showAt, hide, node };
}

// --- Grouped histogram (score distribution) -----------------------------------------

export function ScoreHistogram({
  pre,
  post,
  max,
}: {
  pre: { bin: number; count: number }[];
  post: { bin: number; count: number }[];
  max: number;
}) {
  const t = useTooltip();
  const nPre = pre.reduce((a, b) => a + b.count, 0);
  const nPost = post.reduce((a, b) => a + b.count, 0);
  const share = (c: number, n: number) => (n ? c / n : 0);
  const bins = Array.from({ length: max + 1 }, (_, i) => i);
  const peak = Math.max(
    0.05,
    ...pre.map((b) => share(b.count, nPre)),
    ...post.map((b) => share(b.count, nPost)),
  );
  const yMax = Math.ceil(peak * 10) / 10;

  const W = 640;
  const H = 240;
  const m = { t: 12, r: 8, b: 34, l: 40 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const band = iw / bins.length;
  const barW = Math.min(18, (band - 8) / 2);
  const y = (v: number) => m.t + ih - (v / yMax) * ih;
  const ticks = [0, yMax / 2, yMax];

  const summary = `Score distribution. PRE n=${nPre}, POST n=${nPost}. ` +
    bins.map((b) => `Score ${b}: PRE ${pct(share(pre[b]?.count ?? 0, nPre))}, POST ${pct(share(post[b]?.count ?? 0, nPost))}`).join("; ");

  return (
    <figure className="chart">
      <Legend labels={{ pre: `PRE (n=${nPre})`, post: `POST (n=${nPost})` }} />
      <div className="chart-frame" ref={t.ref} onMouseLeave={t.hide}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} className="chart-svg">
          {ticks.map((v) => (
            <g key={v}>
              <line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} className="grid" />
              <text x={m.l - 8} y={y(v)} dy="0.32em" textAnchor="end" className="axis-label">
                {Math.round(v * 100)}%
              </text>
            </g>
          ))}
          {bins.map((b, i) => {
            const cx = m.l + band * i + band / 2;
            const vals: [Series, number, number][] = [
              ["pre", share(pre[b]?.count ?? 0, nPre), pre[b]?.count ?? 0],
              ["post", share(post[b]?.count ?? 0, nPost), post[b]?.count ?? 0],
            ];
            const content = (
              <>
                <strong>
                  Score {b}
                  {b < max ? `–${b + 1}` : ""}
                </strong>
                {vals.map(([s, v, c]) => (
                  <div key={s} className="chart-tip__row">
                    <span className={`swatch swatch--${s}`} />
                    {SERIES_LABEL[s]} {pct(v)} <span className="muted">({c})</span>
                  </div>
                ))}
              </>
            );
            return (
              <g key={b}>
                {vals.map(([s, v], j) => {
                  const h = Math.max(0, m.t + ih - y(v));
                  const x = cx - barW - 1 + j * (barW + 2);
                  return h > 0 ? <BarUp key={s} x={x} y={y(v)} w={barW} h={h} className={`fill--${s}`} /> : null;
                })}
                <rect
                  x={m.l + band * i}
                  y={m.t}
                  width={band}
                  height={ih}
                  className="hit"
                  tabIndex={0}
                  aria-label={`Score ${b}: PRE ${pct(vals[0][1])}, POST ${pct(vals[1][1])}`}
                  onMouseMove={(e) => t.show(e, content)}
                  onFocus={(e) => t.showAt(e.currentTarget, content)}
                  onBlur={t.hide}
                />
                <text x={cx} y={H - m.b + 18} textAnchor="middle" className="axis-label">
                  {b}
                </text>
              </g>
            );
          })}
          <line x1={m.l} x2={W - m.r} y1={m.t + ih} y2={m.t + ih} className="baseline" />
          <text x={m.l + iw / 2} y={H - 2} textAnchor="middle" className="axis-title">
            Knowledge score (out of {max}) · share of responses
          </text>
        </svg>
        {t.node}
      </div>
      <table className="sr-only">
        <caption>Score distribution (share of responses)</caption>
        <thead>
          <tr>
            <th>Score</th>
            <th>PRE</th>
            <th>POST</th>
          </tr>
        </thead>
        <tbody>
          {bins.map((b) => (
            <tr key={b}>
              <td>{b}</td>
              <td>{pre[b]?.count ?? 0}</td>
              <td>{post[b]?.count ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Vertical bar with a 4px rounded top and square baseline end. */
function BarUp({ x, y, w, h, className }: { x: number; y: number; w: number; h: number; className: string }) {
  const r = Math.min(4, w / 2, h);
  const d = `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
  return <path d={d} className={className} />;
}

// --- Slope chart for matched pairs ---------------------------------------------------

export function SlopeChart({ pairs, max }: { pairs: { pre: number; post: number }[]; max: number }) {
  const t = useTooltip();
  // Identical pairs are merged and drawn thicker so overlapping lines stay legible.
  const grouped = new Map<string, { pre: number; post: number; n: number }>();
  for (const p of pairs) {
    const k = `${p.pre}|${p.post}`;
    const g = grouped.get(k) ?? { ...p, n: 0 };
    g.n++;
    grouped.set(k, g);
  }
  const lines = [...grouped.values()];
  const meanPre = pairs.reduce((a, p) => a + p.pre, 0) / pairs.length;
  const meanPost = pairs.reduce((a, p) => a + p.post, 0) / pairs.length;

  const W = 420;
  const H = 300;
  const m = { t: 20, r: 64, b: 28, l: 64 };
  const x0 = m.l;
  const x1 = W - m.r;
  const y = (v: number) => m.t + (H - m.t - m.b) * (1 - v / max);
  const ticks = [0, max / 2, max];
  const dir = (p: { pre: number; post: number }) => (p.post > p.pre ? "up" : p.post < p.pre ? "down" : "flat");
  const counts = { up: 0, down: 0, flat: 0 };
  for (const p of pairs) counts[dir(p)]++;

  return (
    <figure className="chart">
      <ul className="legend" aria-label="Legend">
        <li>
          <span className="swatch swatch--line-up" aria-hidden="true" />
          Improved ({counts.up})
        </li>
        <li>
          <span className="swatch swatch--line-flat" aria-hidden="true" />
          No change ({counts.flat})
        </li>
        <li>
          <span className="swatch swatch--line-down" aria-hidden="true" />
          Declined ({counts.down})
        </li>
        <li>
          <span className="swatch swatch--line-mean" aria-hidden="true" />
          Mean
        </li>
      </ul>
      <div className="chart-frame chart-frame--slope" ref={t.ref} onMouseLeave={t.hide}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          className="chart-svg"
          aria-label={`Paired scores for ${pairs.length} participants. Mean ${meanPre.toFixed(2)} at PRE and ${meanPost.toFixed(2)} at POST. ${counts.up} improved, ${counts.flat} unchanged, ${counts.down} declined.`}
        >
          {ticks.map((v) => (
            <g key={v}>
              <line x1={x0} x2={x1} y1={y(v)} y2={y(v)} className="grid" />
              <text x={x0 - 12} y={y(v)} dy="0.32em" textAnchor="end" className="axis-label">
                {v}
              </text>
            </g>
          ))}
          <line x1={x0} x2={x0} y1={y(max)} y2={y(0)} className="baseline" />
          <line x1={x1} x2={x1} y1={y(max)} y2={y(0)} className="baseline" />
          {lines.map((l) => {
            const content = (
              <>
                <strong>
                  {l.n} participant{l.n === 1 ? "" : "s"}
                </strong>
                <div>
                  {l.pre.toFixed(1)} → {l.post.toFixed(1)} ({l.post - l.pre >= 0 ? "+" : "−"}
                  {Math.abs(l.post - l.pre).toFixed(1)})
                </div>
              </>
            );
            return (
              <g key={`${l.pre}|${l.post}`} className={`slope slope--${dir(l)}`}>
                <line
                  x1={x0}
                  x2={x1}
                  y1={y(l.pre)}
                  y2={y(l.post)}
                  strokeWidth={Math.min(6, 1.25 + (l.n - 1) * 0.9)}
                />
                <line
                  x1={x0}
                  x2={x1}
                  y1={y(l.pre)}
                  y2={y(l.post)}
                  className="hit-line"
                  onMouseMove={(e) => t.show(e, content)}
                />
              </g>
            );
          })}
          <g className="slope slope--mean">
            <line x1={x0} x2={x1} y1={y(meanPre)} y2={y(meanPost)} />
            <circle cx={x0} cy={y(meanPre)} r={5} />
            <circle cx={x1} cy={y(meanPost)} r={5} />
            <text x={x0 - 12} y={y(meanPre)} dy="-0.7em" textAnchor="end" className="value-label">
              {meanPre.toFixed(2)}
            </text>
            <text x={x1 + 12} y={y(meanPost)} dy="0.32em" className="value-label">
              {meanPost.toFixed(2)}
            </text>
          </g>
          <text x={x0} y={H - 6} textAnchor="middle" className="axis-title">
            PRE
          </text>
          <text x={x1} y={H - 6} textAnchor="middle" className="axis-title">
            POST
          </text>
        </svg>
        {t.node}
      </div>
    </figure>
  );
}

// --- Horizontal paired bars (HTML) ---------------------------------------------------

/** Two thin bars (PRE, POST) for a proportion 0..1, with direct value labels. */
export function PairBars({ pre, post, label }: { pre: number | null; post: number | null; label: string }) {
  return (
    <div className="pair-bars" role="img" aria-label={`${label}: PRE ${pct(pre)}, POST ${pct(post)}`}>
      {(["pre", "post"] as Series[]).map((s) => {
        const v = s === "pre" ? pre : post;
        return (
          <div className="pair-bars__row" key={s}>
            <span className="pair-bars__tag">{SERIES_LABEL[s]}</span>
            <span className="track">
              {v !== null && <span className={`bar bar--${s}`} style={{ width: `${Math.max(v * 100, v > 0 ? 1.5 : 0)}%` }} />}
            </span>
            <span className="pair-bars__value tabular">{pct(v)}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Single thin bar with a value label (used for option shares and categorical counts). */
export function ShareBar({
  value,
  tone = "neutral",
  label,
}: {
  value: number;
  tone?: "neutral" | "pre" | "post" | "good";
  label: string;
}) {
  return (
    <span className="share-bar" title={label}>
      <span className="track">
        <span className={`bar bar--${tone}`} style={{ width: `${Math.max(value * 100, value > 0 ? 1.5 : 0)}%` }} />
      </span>
    </span>
  );
}

// --- Likert distribution (grouped columns) --------------------------------------------

export function LikertChart({ pre, post, labels }: { pre: number[]; post: number[]; labels: string[] }) {
  const t = useTooltip();
  const nPre = pre.reduce((a, b) => a + b, 0);
  const nPost = post.reduce((a, b) => a + b, 0);
  const share = (c: number, n: number) => (n ? c / n : 0);
  const peak = Math.max(0.05, ...pre.map((c) => share(c, nPre)), ...post.map((c) => share(c, nPost)));
  const yMax = Math.ceil(peak * 10) / 10;
  const W = 420;
  const H = 200;
  const m = { t: 10, r: 8, b: 40, l: 38 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const band = iw / labels.length;
  const barW = Math.min(22, (band - 12) / 2);
  const y = (v: number) => m.t + ih - (v / yMax) * ih;

  return (
    <figure className="chart">
      <Legend labels={{ pre: `PRE (n=${nPre})`, post: `POST (n=${nPost})` }} />
      <div className="chart-frame" ref={t.ref} onMouseLeave={t.hide}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          className="chart-svg"
          aria-label={`Confidence ratings 1 to 5. ${labels
            .map((l, i) => `${i + 1} ${l}: PRE ${pct(share(pre[i], nPre))}, POST ${pct(share(post[i], nPost))}`)
            .join("; ")}`}
        >
          {[0, yMax / 2, yMax].map((v) => (
            <g key={v}>
              <line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} className="grid" />
              <text x={m.l - 8} y={y(v)} dy="0.32em" textAnchor="end" className="axis-label">
                {Math.round(v * 100)}%
              </text>
            </g>
          ))}
          {labels.map((l, i) => {
            const cx = m.l + band * i + band / 2;
            const vals: [Series, number, number][] = [
              ["pre", share(pre[i], nPre), pre[i]],
              ["post", share(post[i], nPost), post[i]],
            ];
            const content = (
              <>
                <strong>
                  {i + 1} · {l}
                </strong>
                {vals.map(([s, v, c]) => (
                  <div key={s} className="chart-tip__row">
                    <span className={`swatch swatch--${s}`} />
                    {SERIES_LABEL[s]} {pct(v)} <span className="muted">({c})</span>
                  </div>
                ))}
              </>
            );
            return (
              <g key={l}>
                {vals.map(([s, v], j) => {
                  const h = Math.max(0, m.t + ih - y(v));
                  return h > 0 ? <BarUp key={s} x={cx - barW - 1 + j * (barW + 2)} y={y(v)} w={barW} h={h} className={`fill--${s}`} /> : null;
                })}
                <rect
                  x={m.l + band * i}
                  y={m.t}
                  width={band}
                  height={ih}
                  className="hit"
                  tabIndex={0}
                  aria-label={`${i + 1} ${l}: PRE ${pct(vals[0][1])}, POST ${pct(vals[1][1])}`}
                  onMouseMove={(e) => t.show(e, content)}
                  onFocus={(e) => t.showAt(e.currentTarget, content)}
                  onBlur={t.hide}
                />
                <text x={cx} y={H - m.b + 16} textAnchor="middle" className="axis-label">
                  {i + 1}
                </text>
                <text x={cx} y={H - m.b + 30} textAnchor="middle" className="axis-label axis-label--faint">
                  {l}
                </text>
              </g>
            );
          })}
          <line x1={m.l} x2={W - m.r} y1={m.t + ih} y2={m.t + ih} className="baseline" />
        </svg>
        {t.node}
      </div>
    </figure>
  );
}
