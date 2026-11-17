import { drawStrings } from "../../../strings/draw.pt-BR";

/** Team 1 is Laranja (A), team 2 Azul (B); from the third on there is no color yet, the card is neutral. */
export type TeamColor = "orange" | "blue" | "neutral";

export interface TeamIdentity {
  /** 1 for the first team. */
  readonly number: number;
  readonly letter: string;
  readonly name: string;
  readonly color: TeamColor;
}

const LETTER_A = "A".charCodeAt(0);
const COLORED: readonly { readonly color: TeamColor; readonly name: string }[] = [
  { color: "orange", name: drawStrings.teamNames.orange },
  { color: "blue", name: drawStrings.teamNames.blue },
];

export function teamIdentity(index: number): TeamIdentity {
  const number = index + 1;
  const letter = String.fromCharCode(LETTER_A + index);
  const colored = COLORED[index];
  return colored === undefined
    ? { number, letter, name: drawStrings.otherTeam(number), color: "neutral" }
    : { number, letter, ...colored };
}
