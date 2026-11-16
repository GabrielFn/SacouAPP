import { checkDisplayText } from "@sacou/match-engine";

/**
 * The rule of `Nickname` (`perfil-e-nota.md`): the text rule of the group name with 20 characters as the
 * person sees them (and 80 code points, which `checkDisplayText` derives from the 20).
 */
export const NICKNAME_MAX_LENGTH = 20;

/** The code points the rule allows per character, and the UTF-16 units of the widest code point. */
const MAX_CODE_POINTS_PER_CHARACTER = 4;
const UTF16_UNITS_PER_CODE_POINT = 2;
/**
 * The `maxLength` of the field, in UTF-16 units: room for the longest nickname the rule allows, so the
 * field never cuts an emoji in half; the rule itself says when it is too long.
 */
export const NICKNAME_FIELD_LIMIT =
  NICKNAME_MAX_LENGTH * MAX_CODE_POINTS_PER_CHARACTER * UTF16_UNITS_PER_CODE_POINT;

export type NicknameProblem = "required" | "too-long" | "invalid";

/** What the app sends: trimmed and in NFC, as the API keeps it. */
export function normalizedNickname(text: string): string {
  return text.trim().normalize("NFC");
}

/** `null` when the nickname would be accepted by the API. */
export function nicknameProblem(text: string): NicknameProblem | null {
  const nickname = normalizedNickname(text);
  if (nickname === "") return "required";
  const code = checkDisplayText(nickname, NICKNAME_MAX_LENGTH);
  if (code === null) return null;
  return code === "settings.out-of-range" ? "too-long" : "invalid";
}
