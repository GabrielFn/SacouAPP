import { NON_PRINTABLE_ASCII, SPACE_RUN } from "./constants.data.js";

/**
 * Keeps printable ASCII only, so that the TLV length counts the same in bytes and characters. The
 * cut comes after the cleanup and is followed by a second trim, because it can end on a space.
 */
export function normalizeMerchantText(text: string, maxLength: number): string {
  return text
    .normalize("NFD")
    .replace(NON_PRINTABLE_ASCII, "")
    .replace(SPACE_RUN, " ")
    .trim()
    .slice(0, maxLength)
    .trim();
}
