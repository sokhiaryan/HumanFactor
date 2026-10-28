// Number formatting for the dashboard. Every formatter renders null/undefined as an
// em dash so missing statistics are never shown as zero.

type N = number | null | undefined;

const missing = (x: N): x is null | undefined => x === null || x === undefined || Number.isNaN(x);

export const DASH = "—";

export const num = (x: N, digits = 2) => (missing(x) ? DASH : x.toFixed(digits));

export const int = (x: N) => (missing(x) ? DASH : Math.round(x).toLocaleString());

export const pct = (x: N, digits = 0) => (missing(x) ? DASH : `${(x * 100).toFixed(digits)}%`);

export const signed = (x: N, digits = 2) => (missing(x) ? DASH : `${x > 0 ? "+" : x < 0 ? "−" : "±"}${Math.abs(x).toFixed(digits)}`);

/** Percentage-point change from a proportion delta (0.12 → "+12 pp"). */
export const pp = (x: N) => (missing(x) ? DASH : `${signed(x * 100, 0)} pp`);

export const pval = (p: N) => (missing(p) ? DASH : p < 0.001 ? "< .001" : p.toFixed(3).replace(/^0/, ""));

export const ci = (c: [number, number] | null | undefined, digits = 2) =>
  c ? `${num(c[0], digits)} – ${num(c[1], digits)}` : DASH;

export const signedCi = (c: [number, number] | null | undefined, digits = 2) =>
  c ? `${signed(c[0], digits)} to ${signed(c[1], digits)}` : DASH;

export function duration(seconds: N): string {
  if (missing(seconds)) return DASH;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`;
}

export const time = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
