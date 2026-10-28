import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { CODE_ALPHABET, formatCode, generateCode, isValidCode, normalizeCode } from "../shared/participantCode.js";

describe("participant codes", () => {
  const codes = Array.from({ length: 500 }, () => generateCode((n) => randomBytes(n)));

  it("generates valid 8-character codes", () => {
    for (const c of codes) {
      expect(c).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);
      expect(isValidCode(c)).toBe(true);
    }
  });

  it("accepts formatting, lower case and look-alike characters", () => {
    const c = codes[0];
    expect(isValidCode(formatCode(c).toLowerCase())).toBe(true);
    expect(isValidCode(` ${c.slice(0, 4)} ${c.slice(4)} `)).toBe(true);
    expect(normalizeCode("o0-il")).toBe("00" + "11");
  });

  it("detects every single-character typo", () => {
    for (const c of codes.slice(0, 50)) {
      for (let i = 0; i < c.length; i++) {
        for (const ch of CODE_ALPHABET) {
          if (ch === c[i]) continue;
          const typo = c.slice(0, i) + ch + c.slice(i + 1);
          // A substitution that changes a value by exactly 31 is the only blind spot of mod 31.
          const delta = Math.abs(CODE_ALPHABET.indexOf(ch) - CODE_ALPHABET.indexOf(c[i]));
          if (delta !== 31) expect(isValidCode(typo)).toBe(false);
        }
      }
    }
  });

  it("rejects wrong lengths and characters", () => {
    expect(isValidCode("")).toBe(false);
    expect(isValidCode("ABC")).toBe(false);
    expect(isValidCode("ABCDEFGHJ")).toBe(false);
    expect(isValidCode("ABCD-EFG!")).toBe(false);
  });
});
