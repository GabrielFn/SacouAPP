import { summaryStrings } from "../../../strings/summary.pt-BR";
import type { RoundSummaryReport } from "../../../services/api/sacou-api";
import { teamIdentity } from "../../draw/model/team-identity";
import type { TeamColor } from "../../draw/model/team-identity";

export type SummarySide = "a" | "b";

const SIDE_INDEX: Readonly<Record<SummarySide, number>> = { a: 0, b: 1 };

export interface SideLook {
  /** "A Laranja" / "B Azul". */
  readonly label: string;
  /** "Laranja" / "Azul". */
  readonly name: string;
  readonly color: TeamColor;
}

/** A side is a team color (answer P3 of the E2.9): the server sends only `a` or `b`. */
export function sideLook(side: SummarySide): SideLook {
  const identity = teamIdentity(SIDE_INDEX[side]);
  return {
    label: summaryStrings.teamLabel(identity.letter, identity.name),
    name: identity.name,
    color: identity.color,
  };
}

/** "Racha de terça · 4 partidas"; without the group name yet, only the matches. */
export function headerLine(groupName: string | null, finishedMatches: number): string {
  const matches = summaryStrings.matches(finishedMatches);
  return groupName === null || groupName === "" ? matches : `${groupName} · ${matches}`;
}

export interface MvpLineInput {
  readonly side: SummarySide | null;
  readonly plusMinus: number;
  readonly wins: number;
  readonly matchesPlayed: number;
}

/** "Laranja · +2 de saldo · 2 vitórias em 3"; the side is left out when the server did not send one. */
export function mvpLine({ side, plusMinus, wins, matchesPlayed }: MvpLineInput): string {
  const parts = [
    ...(side === null ? [] : [sideLook(side).name]),
    summaryStrings.plusMinus(plusMinus),
    summaryStrings.winsOf(wins, matchesPlayed),
  ];
  return parts.join(" · ");
}

/** "+2 de saldo, 2 vitórias em 3": the numbers of the MVP without the side, for the shared text. */
export function mvpDetail({ plusMinus, wins, matchesPlayed }: MvpLineInput): string {
  return [summaryStrings.plusMinus(plusMinus), summaryStrings.winsOf(wins, matchesPlayed)].join(
    ", ",
  );
}

/** Whether the MVP came from the votes (E3.18): then "Calculado pelo placar" is not true. */
export function mvpIsFromVotes(mvp: object): boolean {
  return "source" in mvp && mvp.source === "votes";
}

export type SummaryMvp = NonNullable<RoundSummaryReport["mvp"]>;
