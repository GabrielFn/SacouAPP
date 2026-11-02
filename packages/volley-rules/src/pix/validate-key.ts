import { KEY_PATTERNS, MAX_KEY_LENGTH } from "./constants.data.js";
import type { PixKey } from "./types.js";

const PATTERN_BY_KEY_TYPE: ReadonlyMap<string, RegExp> = new Map(Object.entries(KEY_PATTERNS));

/** The caller's types do not hold at run time: the input may come straight from a JSON body. */
type UntrustedPixKey = Readonly<Partial<Record<keyof PixKey, unknown>>> | null | undefined;

/**
 * Format only: the CPF example in the Pix manual has no valid check digit. Anything but a string
 * fails, because `RegExp.test` would coerce an array into a text that matches the pattern.
 */
export function isValidPixKey(key: UntrustedPixKey): boolean {
  const type = key?.type;
  const value = key?.value;
  if (typeof type !== "string" || typeof value !== "string") {
    return false;
  }
  const pattern = PATTERN_BY_KEY_TYPE.get(type);
  return pattern !== undefined && value.length <= MAX_KEY_LENGTH && pattern.test(value);
}
