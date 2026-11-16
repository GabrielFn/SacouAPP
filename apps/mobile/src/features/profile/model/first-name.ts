import { nicknameProblem, normalizedNickname } from "./nickname";

const WHITESPACE = /\s+/u;

/**
 * The suggested nickname (question 40): the first name of the provider ("João Ferreira" is "João"). A
 * first name the nickname rule refuses gives an empty field, never one cut in the middle of a character.
 */
export function firstName(displayName: string | null): string {
  if (displayName === null) return "";
  const [first = ""] = normalizedNickname(displayName).split(WHITESPACE);
  return nicknameProblem(first) === null ? first : "";
}
