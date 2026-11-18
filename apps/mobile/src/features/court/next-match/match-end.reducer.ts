import type { MemberId, TeamSide } from "@sacou/match-engine";

import type { CourtSessionOrigin } from "../ports/court-event-log";
import type { NextMatchDraft } from "../ports/next-match-draft-store";

/**
 * What screen 11 keeps: where the session came from (to read the round), the draft of the next match
 * (its own copy is persisted, D7) and the start in progress. The plan itself is derived on each read.
 */
export type MatchEndState =
  | { readonly status: "loading" }
  | {
      readonly status: "ready";
      readonly origin: CourtSessionOrigin | null;
      readonly draft: NextMatchDraft;
      readonly starting: boolean;
      /** Why the last "Confirmar" did not start the next match, or `null`. */
      readonly failure: string | null;
    };

export type MatchEndAction =
  | {
      readonly type: "loaded";
      readonly origin: CourtSessionOrigin | null;
      readonly draft: NextMatchDraft;
    }
  | {
      readonly type: "member-toggled";
      readonly side: TeamSide;
      readonly memberId: MemberId;
      readonly required: number;
    }
  | { readonly type: "start-requested" }
  | { readonly type: "start-failed"; readonly text: string };

export const INITIAL_MATCH_END: MatchEndState = { status: "loading" };

/** A tap picks or unpicks; a full pick takes no one else, so the count is never passed (D7). */
function toggled(
  chosen: readonly MemberId[],
  memberId: MemberId,
  required: number,
): readonly MemberId[] {
  if (chosen.includes(memberId)) return chosen.filter((id) => id !== memberId);
  return chosen.length < required ? [...chosen, memberId] : chosen;
}

export function matchEndReducer(state: MatchEndState, action: MatchEndAction): MatchEndState {
  if (action.type === "loaded") {
    return {
      status: "ready",
      origin: action.origin,
      draft: action.draft,
      starting: false,
      failure: null,
    };
  }
  if (state.status !== "ready") return state;
  switch (action.type) {
    case "member-toggled": {
      const { chosen } = state.draft;
      const side = toggled(chosen[action.side], action.memberId, action.required);
      return { ...state, draft: { ...state.draft, chosen: { ...chosen, [action.side]: side } } };
    }
    case "start-requested":
      return state.starting ? state : { ...state, starting: true, failure: null };
    case "start-failed":
      return { ...state, starting: false, failure: action.text };
  }
}
