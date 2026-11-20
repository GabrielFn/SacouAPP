const INITIALS_LENGTH = 2;
const INITIAL_CHARACTER = /[\p{L}\p{N}]/gu;

/**
 * "DU" for Duda: the first two letters or digits of a name (accents composed, so "e" and a combining
 * accent count once); `null` when it has none. The one function of the avatars (members, court, card).
 */
export function initialsOfName(name: string): string | null {
  const letters = name.normalize("NFC").match(INITIAL_CHARACTER) ?? [];
  const initials = letters.slice(0, INITIALS_LENGTH).join("").toLocaleUpperCase("pt-BR");
  return initials === "" ? null : initials;
}
