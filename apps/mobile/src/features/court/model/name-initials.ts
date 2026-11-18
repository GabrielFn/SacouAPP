const INITIALS_LENGTH = 2;
const INITIAL_CHARACTER = /[\p{L}\p{N}]/gu;

/** "DU" for Duda: the first two letters or digits of a name; `null` when it has none. */
export function initialsOfName(name: string): string | null {
  const letters = name.match(INITIAL_CHARACTER) ?? [];
  const initials = letters.slice(0, INITIALS_LENGTH).join("").toLocaleUpperCase("pt-BR");
  return initials === "" ? null : initials;
}
