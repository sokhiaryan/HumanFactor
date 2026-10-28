// Anonymous participant codes, e.g. "K7QM-3XP9".
//
// Seven random characters from Crockford's base-32 alphabet (no I, L, O, U, so codes
// are easy to read aloud and copy) plus one check character. The check character
// catches any single mistyped character and most swapped neighbours, so typos are
// rejected before they can cause a mismatched PRE/POST pair.

export const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const BODY_LENGTH = 7;
const CHECK_MODULUS = 31; // prime, so every weight 1..7 is invertible

function checkChar(body: string): string {
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    sum += (i + 1) * CODE_ALPHABET.indexOf(body[i]);
  }
  return CODE_ALPHABET[sum % CHECK_MODULUS];
}

/** Uppercases, strips separators and maps look-alike characters (O→0, I/L→1). */
export function normalizeCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[\s\-_.]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
}

export function isValidCode(input: string): boolean {
  const code = normalizeCode(input);
  if (code.length !== BODY_LENGTH + 1) return false;
  for (const ch of code) if (!CODE_ALPHABET.includes(ch)) return false;
  return checkChar(code.slice(0, BODY_LENGTH)) === code[BODY_LENGTH];
}

/** Formats a normalised code as XXXX-XXXX for display. */
export function formatCode(input: string): string {
  const code = normalizeCode(input);
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/** Generates a new code using the supplied source of random bytes. */
export function generateCode(randomBytes: (n: number) => Uint8Array): string {
  const bytes = randomBytes(BODY_LENGTH);
  let body = "";
  for (const b of bytes) body += CODE_ALPHABET[b % 32]; // 256 is a multiple of 32: no bias
  return body + checkChar(body);
}
