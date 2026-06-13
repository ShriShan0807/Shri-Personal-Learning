import { randomBytes } from "crypto";

// Base32 alphabet (Crockford-ish, no easily-confused chars I/L/O/U).
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Generate a cryptographically-random base32 suffix to deter code forgery. */
export function randomSuffix(length = 4): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

/** Build an item code: {PREFIX}-{zero-padded SEQ}-{RANDOM}. e.g. MILK1L-000123-7F2A */
export function buildItemCode(prefix: string, seq: number, suffixLen = 4): string {
  const seqPart = String(seq).padStart(6, "0");
  return `${prefix}-${seqPart}-${randomSuffix(suffixLen)}`;
}

/** Validate a code prefix: uppercase letters/digits, 2-16 chars. */
export function isValidPrefix(prefix: string): boolean {
  return /^[A-Z0-9]{2,16}$/.test(prefix);
}
