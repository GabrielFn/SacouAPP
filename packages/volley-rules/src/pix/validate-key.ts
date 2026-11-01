import { KEY_PATTERNS, MAX_KEY_LENGTH } from "./constants.data.js";
import type { PixKey } from "./types.js";

const PATTERN_BY_KEY_TYPE: ReadonlyMap<string, RegExp> = new Map(Object.entries(KEY_PATTERNS));

/** Format only: the CPF example in the Pix manual has no valid check digit. Unknown types fail. */
export function isValidPixKey(key: PixKey): boolean {
  const pattern = PATTERN_BY_KEY_TYPE.get(key.type);
  return pattern !== undefined && key.value.length <= MAX_KEY_LENGTH && pattern.test(key.value);
}
