import { NON_PRINTABLE_ASCII, SPACE_LOOKALIKE, SPACE_RUN } from "./constants.data.js";

/**
 * Keeps printable ASCII only, so that the TLV length counts the same in bytes and characters. The
 * cut comes after the cleanup and is followed by a second trim, because it can end on a space.
 * Anything but a string becomes empty, which the caller rejects: the input may come straight from
 * a JSON body, whatever its compile-time type says.
 */
export function normalizeMerchantText(text: unknown, maxLength: number): string {
  if (typeof text !== "string") {
    return "";
  }
  return text
    .replace(SPACE_LOOKALIKE, " ")
    .normalize("NFD")
    .replace(NON_PRINTABLE_ASCII, "")
    .replace(SPACE_RUN, " ")
    .trim()
    .slice(0, maxLength)
    .trim();
}
