import type { MemberId, TeamSide } from "@sacou/match-engine";

/**
 * What screen 23a keeps: the team and the two picks. The lineup and the bench come from the log,
 * so each pick is validated on every read (the selectors), since another writer may change them.
 */
export interface SubstitutionState {
  readonly team: TeamSide | null;
  readonly outgoing: MemberId | null;
  readonly incoming: MemberId | null;
  /** Why the last "Trocar" did nothing; any new pick clears it. */
  readonly refusal: string | null;
}

export type SubstitutionAction =
  | { readonly type: "team-chosen"; readonly team: TeamSide }
  | { readonly type: "outgoing-chosen"; readonly memberId: MemberId }
  | { readonly type: "incoming-chosen"; readonly memberId: MemberId }
  | { readonly type: "command-refused"; readonly text: string };

export const INITIAL_SUBSTITUTION: SubstitutionState = {
  team: null,
  outgoing: null,
  incoming: null,
  refusal: null,
};

export function substitutionReducer(
  state: SubstitutionState,
  action: SubstitutionAction,
): SubstitutionState {
  switch (action.type) {
    case "team-chosen":
      // The picks belong to a team: another team starts over.
      return state.team === action.team
        ? state
        : { team: action.team, outgoing: null, incoming: null, refusal: null };
    case "outgoing-chosen":
      return { ...state, outgoing: action.memberId, refusal: null };
    case "incoming-chosen":
      return { ...state, incoming: action.memberId, refusal: null };
    case "command-refused":
      return { ...state, refusal: action.text };
  }
}
