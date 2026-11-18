import type { TeamSide } from "@sacou/match-engine";

import { strings } from "../../../strings/pt-BR";
import type { SetEndModel } from "./court-screen.types";

/** What the line under the result of screen 25 says about what comes next. */
export type NextSetLine =
  | { readonly kind: "alternate"; readonly text: string }
  | { readonly kind: "toss"; readonly text: string }
  | { readonly kind: "match-end"; readonly text: string };

export interface SetEndView {
  readonly title: string;
  readonly outcome: string;
  readonly next: NextSetLine;
  readonly confirmLabel: string;
  /** Undoing the last point reopens the set; with only the `MatchEnded` missing there is none. */
  readonly canUndo: boolean;
}

function otherSide(side: TeamSide): TeamSide {
  return side === "a" ? "b" : "a";
}

function nextLine(model: SetEndModel): NextSetLine {
  const { setEnd } = strings.court;
  const won = model.setsAfter[model.winner];
  const lost = model.setsAfter[otherSide(model.winner)];
  if (model.endsMatch) {
    return { kind: "match-end", text: setEnd.winsMatch(model.winnerLabel, won, lost) };
  }
  if (model.nextFirstServer === null) {
    return { kind: "toss", text: setEnd.decider };
  }
  return { kind: "alternate", text: setEnd.nextSet(model.scores[model.nextFirstServer].label) };
}

/** The texts of screen 25 from its model: one per case, never put together on the screen. */
export function setEndView(model: SetEndModel): SetEndView {
  const { setEnd } = strings.court;
  const won = model.setsAfter[model.winner];
  const lost = model.setsAfter[otherSide(model.winner)];
  return {
    title: model.pendingMatchEnd ? setEnd.pendingTitle : setEnd.title(model.setNumber),
    outcome: model.pendingMatchEnd
      ? setEnd.pendingHint
      : setEnd.winsSet(model.winnerLabel, won, lost),
    next: nextLine(model),
    confirmLabel: model.endsMatch ? setEnd.confirmMatch : setEnd.confirm,
    canUndo: !model.pendingMatchEnd,
  };
}

/** "Confirmar" waits for the toss before the deciding set; every other confirmation is ready. */
export function canConfirmSetEnd(model: SetEndModel, toss: TeamSide | null): boolean {
  return !model.needsFirstServer || toss !== null;
}

/**
 * The first server the confirmation carries: the toss before the deciding set, and nothing in any
 * other set, where the engine alternates by itself (pendência 17).
 */
export function firstServerToSend(model: SetEndModel, toss: TeamSide | null): TeamSide | undefined {
  return model.needsFirstServer && toss !== null ? toss : undefined;
}
