// Reference values computed with R 4.x (stats package).
import { describe, expect, it } from "vitest";
import * as s from "../server/stats.js";

describe("descriptives", () => {
  it("mean / median / quantile / sd", () => {
    expect(s.mean([1, 2, 3, 4])).toBe(2.5);
    expect(s.median([3, 1, 2])).toBe(2);
    expect(s.quantile([1, 2, 3, 4], 0.25)).toBeCloseTo(1.75); // quantile(type = 7)
    expect(s.sd([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.13809, 4);
    expect(s.mean([])).toBeNull();
    expect(s.sd([1])).toBeNull();
  });

  it("ranks ties with their average position", () => {
    expect(s.rank([10, 20, 20, 30])).toEqual([1, 2.5, 2.5, 4]);
  });
});

describe("distributions", () => {
  it("t distribution", () => {
    expect(s.tTwoSidedP(2, 10)).toBeCloseTo(0.073388, 5); // 2 * pt(-2, 10)
    expect(s.tCritical(10)).toBeCloseTo(2.228139, 4); // qt(.975, 10)
    expect(s.tCritical(28)).toBeCloseTo(2.048407, 4);
  });

  it("normal CDF", () => {
    expect(s.normalCdf(1.96)).toBeCloseTo(0.9750021, 6);
    expect(s.normalCdf(-1)).toBeCloseTo(0.1586553, 6);
  });
});

describe("tests", () => {
  it("paired t-test", () => {
    const r = s.pairedTTest([1, 2, 3, 4, 5])!; // t.test(1:5)
    expect(r.statistic).toBeCloseTo(4.2426, 4);
    expect(r.df).toBe(4);
    expect(r.p).toBeCloseTo(0.01324, 4);
    expect(s.pairedTTest([1, 1, 1])).toBeNull(); // no variance
    expect(s.pairedTTest([1, 2])).toBeNull(); // too small
  });

  it("Welch t-test", () => {
    const r = s.welchTTest([1, 2, 3, 4, 5], [2, 4, 6, 8, 10])!; // t.test(b, a)
    expect(r.statistic).toBeCloseTo(1.8974, 4);
    expect(r.df).toBeCloseTo(5.8824, 3);
    expect(r.p).toBeCloseTo(0.1076, 3);
  });

  it("95% CI for the mean", () => {
    const [lo, hi] = s.meanCi95([1, 2, 3, 4, 5])!; // t.test(1:5)$conf.int
    expect(lo).toBeCloseTo(1.036757, 4);
    expect(hi).toBeCloseTo(4.963243, 4);
  });

  it("Wilcoxon signed-rank (normal approximation, continuity corrected)", () => {
    // wilcox.test(c(1.5, 2, -0.5, 3, 4, 2.5, -1, 3.5), exact = FALSE): V = 33, p = 0.04232
    const r = s.wilcoxonSignedRank([1.5, 2, -0.5, 3, 4, 2.5, -1, 3.5])!;
    expect(r.statistic).toBe(33);
    expect(r.p).toBeCloseTo(0.04232, 3);
    expect(r.nNonZero).toBe(8);
    expect(s.wilcoxonSignedRank([0, 0, 1, 2])).toBeNull();
  });

  it("exact McNemar", () => {
    expect(s.mcnemarExact(12, 2)).toBeCloseTo(0.012939, 5); // binom.test(2, 14)$p.value
    expect(s.mcnemarExact(5, 5)).toBe(1);
    expect(s.mcnemarExact(0, 0)).toBeNull();
  });

  it("Cohen's d and Spearman's rho", () => {
    expect(s.cohensD([1, 2, 3, 4, 5], [2, 3, 4, 5, 6])).toBeCloseTo(0.6325, 4);
    expect(s.spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1);
    expect(s.spearman([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1);
    expect(s.spearman([1, 1, 1], [1, 2, 3])).toBeNull();
  });
});
