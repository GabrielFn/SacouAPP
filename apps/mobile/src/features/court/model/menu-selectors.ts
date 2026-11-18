import type { CourtSessionTimeline } from "@sacou/match-engine";

import { strings } from "../../../strings/pt-BR";
import type { CourtRoster } from "../ports/court-roster";
import { selectCourtPhase, stateOfTimeline } from "./court-screen.selectors";
import { manualEndWinner } from "./manual-end-winner";

const NEXT = 1;

/** The screens the menu points to that are not built yet: their items are hidden (E4.10, D1 and D8). */
export const PENDING_COURT_MENU_SCREENS = ["lineup", "substitution"] as const;

export type MenuScreen = "lineup" | "substitution" | "corrections";

export function isMenuScreenReady(screen: MenuScreen): boolean {
  return !(PENDING_COURT_MENU_SCREENS as readonly MenuScreen[]).includes(screen);
}

/** "Partida 3 · 2º set · Laranja 18–15 Azul"; `null` without a set in play. */
export function menuSubtitle(timeline: CourtSessionTimeline, roster: CourtRoster): string | null {
  const state = stateOfTimeline(timeline);
  const match = state.currentMatch;
  const set = match?.currentSet ?? null;
  if (match === null || set === null) {
    return null;
  }
  const first = roster.teamAppearance(match.matchId, "a").label;
  const second = roster.teamAppearance(match.matchId, "b").label;
  const { menu } = strings.court;
  return menu.subtitle(
    state.finishedMatches.length + NEXT,
    set.setNumber,
    menu.scoreLine(first, set.score.a, set.score.b, second),
  );
}

/** What "Encerrar partida" does and says: derived from the match, never kept. */
export type EndMatchSummary =
  /** The set is decided and waiting: the way is to confirm it (screen 25). */
  | { readonly kind: "confirm-set" }
  | {
      readonly kind: "wins-on-sets";
      readonly winner: string;
      readonly won: number;
      readonly lost: number;
    }
  | {
      readonly kind: "wins-on-points";
      readonly winner: string;
      readonly won: number;
      readonly lost: number;
      readonly setNumber: number;
    }
  | { readonly kind: "no-winner" };

export function endMatchSummary(
  timeline: CourtSessionTimeline,
  roster: CourtRoster,
): EndMatchSummary | null {
  const state = stateOfTimeline(timeline);
  const match = state.currentMatch;
  if (match === null) {
    return null;
  }
  const phase = selectCourtPhase(state);
  if (phase === "set-decided" || phase === "match-pending") {
    return { kind: "confirm-set" };
  }
  const winner = manualEndWinner(match);
  if (winner === null) {
    return { kind: "no-winner" };
  }
  const loser = winner === "a" ? "b" : "a";
  const winnerLabel = roster.teamAppearance(match.matchId, winner).label;
  const set = match.currentSet;
  if (match.setsWon[winner] !== match.setsWon[loser] || set === null) {
    return {
      kind: "wins-on-sets",
      winner: winnerLabel,
      won: match.setsWon[winner],
      lost: match.setsWon[loser],
    };
  }
  return {
    kind: "wins-on-points",
    winner: winnerLabel,
    won: set.score[winner],
    lost: set.score[loser],
    setNumber: set.setNumber,
  };
}

/** The sentence of the dialog for a summary that ends the match here; `confirm-set` has none. */
export function endMatchSentence(summary: EndMatchSummary): string {
  const { endMatchDialog } = strings.court;
  switch (summary.kind) {
    case "wins-on-sets":
      return endMatchDialog.winsOnSets(summary.winner, summary.won, summary.lost);
    case "wins-on-points":
      return endMatchDialog.winsOnPoints(
        summary.winner,
        summary.won,
        summary.lost,
        summary.setNumber,
      );
    case "no-winner":
    case "confirm-set":
      return endMatchDialog.noWinner;
  }
}
