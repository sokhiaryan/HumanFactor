// Small, dependency-free statistics helpers used by the analytics endpoint.
// All tests are two-sided. Functions return null when the sample is too small for the
// statistic to be defined, rather than a misleading number.

export function mean(xs: number[]): number | null {
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Quantile using linear interpolation between order statistics (R type 7). */
export function quantile(xs: number[], p: number): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const h = (s.length - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  return s[lo] + (h - lo) * (s[hi] - s[lo]);
}

export const median = (xs: number[]) => quantile(xs, 0.5);

/** Sample standard deviation (n − 1). */
export function sd(xs: number[]): number | null {
  if (xs.length < 2) return null;
  const m = mean(xs)!;
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

// --- Distributions ---------------------------------------------------------

function logGamma(x: number): number {
  // Lanczos approximation (g = 7, n = 9)
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Continued fraction for the incomplete beta function (Numerical Recipes, betacf). */
function betacf(a: number, b: number, x: number): number {
  const MAXIT = 300;
  const EPS = 3e-14;
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Regularized incomplete beta I_x(a, b). */
export function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Two-sided p-value for a t statistic with df degrees of freedom. */
export function tTwoSidedP(t: number, df: number): number {
  return incompleteBeta(df / (df + t * t), df / 2, 0.5);
}

/** Inverse of the two-sided t p-value: the critical t for a given alpha (bisection). */
export function tCritical(df: number, alpha = 0.05): number {
  let lo = 0;
  let hi = 1000;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (tTwoSidedP(mid, df) > alpha) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Standard normal CDF (via the complementary error function, |error| < 1.2e-7). */
export function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.5 * x);
  const erfc =
    t *
    Math.exp(
      -x * x -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return z >= 0 ? 1 - erfc / 2 : erfc / 2;
}

// --- Tests ------------------------------------------------------------------

/** 95% t-based confidence interval for the mean. */
export function meanCi95(xs: number[]): [number, number] | null {
  if (xs.length < 2) return null;
  const m = mean(xs)!;
  const se = sd(xs)! / Math.sqrt(xs.length);
  const half = tCritical(xs.length - 1) * se;
  return [m - half, m + half];
}

/** Paired t-test on a list of differences (post − pre). */
export function pairedTTest(diffs: number[]): { statistic: number; df: number; p: number } | null {
  if (diffs.length < 3) return null;
  const s = sd(diffs)!;
  const m = mean(diffs)!;
  if (s === 0) return null; // all differences identical: t undefined
  const t = m / (s / Math.sqrt(diffs.length));
  const df = diffs.length - 1;
  return { statistic: t, df, p: tTwoSidedP(t, df) };
}

/** Welch's unequal-variance t-test for two independent samples. */
export function welchTTest(a: number[], b: number[]): { statistic: number; df: number; p: number } | null {
  if (a.length < 2 || b.length < 2) return null;
  const va = sd(a)! ** 2 / a.length;
  const vb = sd(b)! ** 2 / b.length;
  if (va + vb === 0) return null;
  const t = (mean(b)! - mean(a)!) / Math.sqrt(va + vb);
  const df = (va + vb) ** 2 / (va ** 2 / (a.length - 1) + vb ** 2 / (b.length - 1));
  return { statistic: t, df, p: tTwoSidedP(t, df) };
}

/** Cohen's d with pooled SD (b − a). */
export function cohensD(a: number[], b: number[]): number | null {
  if (a.length < 2 || b.length < 2) return null;
  const pooled = Math.sqrt(((a.length - 1) * sd(a)! ** 2 + (b.length - 1) * sd(b)! ** 2) / (a.length + b.length - 2));
  if (pooled === 0) return null;
  return (mean(b)! - mean(a)!) / pooled;
}

/** Average ranks (1-based), ties receive the mean of their positions. */
export function rank(xs: number[]): number[] {
  const idx = xs.map((v, i) => ({ v, i })).sort((p, q) => p.v - q.v);
  const ranks = new Array<number>(xs.length);
  for (let i = 0; i < idx.length; ) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1].v === idx[i].v) j++;
    const r = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[idx[k].i] = r;
    i = j + 1;
  }
  return ranks;
}

/**
 * Wilcoxon signed-rank test (zeros dropped, normal approximation with tie and continuity
 * correction). The approximation is rough below ~10 non-zero pairs; callers flag that.
 */
export function wilcoxonSignedRank(diffs: number[]): { statistic: number; p: number; nNonZero: number } | null {
  const nz = diffs.filter((d) => d !== 0);
  const n = nz.length;
  if (n < 5) return null;
  const ranks = rank(nz.map(Math.abs));
  const wPlus = nz.reduce((acc, d, i) => (d > 0 ? acc + ranks[i] : acc), 0);
  const meanW = (n * (n + 1)) / 4;
  // tie correction
  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  let tie = 0;
  for (const t of counts.values()) tie += t ** 3 - t;
  const varW = (n * (n + 1) * (2 * n + 1)) / 24 - tie / 48;
  if (varW <= 0) return null;
  const diff = wPlus - meanW;
  const z = (diff - Math.sign(diff) * 0.5) / Math.sqrt(varW);
  return { statistic: wPlus, p: Math.min(1, 2 * (1 - normalCdf(Math.abs(z)))), nNonZero: n };
}

/** Exact two-sided McNemar test from the discordant counts b (0→1) and c (1→0). */
export function mcnemarExact(b: number, c: number): number | null {
  const n = b + c;
  if (n === 0) return null;
  const k = Math.min(b, c);
  let tail = 0;
  let logC = 0; // log(n choose 0)
  for (let i = 0; i <= k; i++) {
    if (i > 0) logC += Math.log(n - i + 1) - Math.log(i);
    tail += Math.exp(logC - n * Math.LN2);
  }
  return Math.min(1, 2 * tail);
}

export function pearson(x: number[], y: number[]): number | null {
  if (x.length !== y.length || x.length < 3) return null;
  const mx = mean(x)!;
  const my = mean(y)!;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < x.length; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

export function spearman(x: number[], y: number[]): number | null {
  return pearson(rank(x), rank(y));
}
