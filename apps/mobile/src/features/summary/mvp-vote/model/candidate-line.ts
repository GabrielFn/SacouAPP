import type { MvpCandidate } from "../../../../services/api/sacou-api";
import { mvpVoteStrings } from "../../../../strings/mvp-vote.pt-BR";
import { sideLook } from "../../model/summary-texts";

/**
 * "Laranja · 5 partidas · +34" on the court; without a side (the sand, question 173, or a player with no
 * main side) only "5 partidas · +34".
 */
export function candidateLine({
  mainSide,
  matchesPlayed,
  plusMinus,
}: Pick<MvpCandidate, "mainSide" | "matchesPlayed" | "plusMinus">): string {
  return [
    ...(mainSide === null ? [] : [sideLook(mainSide).name]),
    mvpVoteStrings.matches(matchesPlayed),
    mvpVoteStrings.balance(plusMinus),
  ].join(" · ");
}
