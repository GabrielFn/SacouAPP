import { BLANK_FILLER_CODE_POINTS as BLANK_FILLERS } from "./constants.data.js";
import type { SettingsErrorCode } from "./types.js";

/**
 * The text rule of `GroupName` in the C#, for free text in the settings (the venue), with an empty
 * text allowed. Characters are counted as code points that are not marks, joiners or skin tones:
 * the same count in TypeScript and C#, without `Intl`, which the engine cannot use (ADR 0041).
 */
const ZERO_WIDTH_JOINER = 0x200d;
const FIRST_SKIN_TONE = 0x1f3fb;
const LAST_SKIN_TONE = 0x1f3ff;
const MAX_MARKS_PER_CHARACTER = 4;
/** As `GroupName`: 60 characters, 240 code points. */
const MAX_CODE_POINTS_PER_CHARACTER = 4;

const HIDDEN = /^[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Cn}\p{Co}\p{Cs}]$/u;
const MARK = /^\p{M}$/u;
const VISIBLE_CONTENT = /[\p{L}\p{N}\p{S}]/u;
const BEFORE_JOINER = /^[\p{So}\p{Sk}\p{Mn}]$/u;
const AFTER_JOINER = /^\p{So}$/u;

function codeOf(character: string): number {
  return character.codePointAt(0) ?? 0;
}

function isSkinTone(code: number): boolean {
  return code >= FIRST_SKIN_TONE && code <= LAST_SKIN_TONE;
}

function countsAsCharacter(character: string): boolean {
  const code = codeOf(character);
  return code !== ZERO_WIDTH_JOINER && !isSkinTone(code) && !MARK.test(character);
}

function joinsEmoji(characters: readonly string[], index: number): boolean {
  const before = characters[index - 1] ?? "";
  const after = characters[index + 1] ?? "";
  return BEFORE_JOINER.test(before) && AFTER_JOINER.test(after);
}

function isVisible(characters: readonly string[], index: number): boolean {
  const character = characters[index] ?? "";
  const code = codeOf(character);
  return code === ZERO_WIDTH_JOINER
    ? joinsEmoji(characters, index)
    : !BLANK_FILLERS.includes(code) && !HIDDEN.test(character);
}

/** Against "zalgo" text: no character carries more than a few marks in a row. */
function hasFewMarksPerCharacter(characters: readonly string[]): boolean {
  const longestRun = characters.reduce(
    (state, character) => {
      const run = MARK.test(character) ? state.run + 1 : 0;
      return { run, longest: Math.max(state.longest, run) };
    },
    { run: 0, longest: 0 },
  );
  return longestRun.longest <= MAX_MARKS_PER_CHARACTER;
}

function isCanonical(text: string): boolean {
  return text === text.trim() && text === text.normalize("NFC");
}

function isWithinLength(characters: readonly string[], maxLength: number): boolean {
  const length = characters.filter(countsAsCharacter).length;
  return length <= maxLength && characters.length <= maxLength * MAX_CODE_POINTS_PER_CHARACTER;
}

function isAllowed(text: string, characters: readonly string[]): boolean {
  return (
    isCanonical(text) &&
    characters.every((_character, index) => isVisible(characters, index)) &&
    VISIBLE_CONTENT.test(text) &&
    hasFewMarksPerCharacter(characters)
  );
}

/** `null` when the text passes; the app trims and normalizes before sending it. */
export function checkDisplayText(text: string, maxLength: number): SettingsErrorCode | null {
  if (text.length === 0) {
    return null;
  }
  const characters = Array.from(text);
  if (characters.some((character) => /^\p{Cs}$/u.test(character))) {
    return "settings.invalid-text";
  }
  if (!isWithinLength(characters, maxLength)) {
    return "settings.out-of-range";
  }
  return isAllowed(text, characters) ? null : "settings.invalid-text";
}
