import type { LevelTenths } from "../../../ui/skill-level";

/**
 * The local state of screen 19b (frontend.md, rule 4): only the level the admin moved on each card, by
 * `MemberId`. The cards themselves are derived from the levels in the query cache; a confirmed member
 * leaves the list because the server says so, not because of this state.
 */
export interface RatingReviewState {
  readonly drafts: Readonly<Record<string, LevelTenths>>;
}

export type RatingReviewAction =
  | { readonly type: "drafted"; readonly memberId: string; readonly tenths: LevelTenths }
  | { readonly type: "sent"; readonly memberIds: readonly string[] };

export const initialRatingReviewState: RatingReviewState = { drafts: {} };

export function ratingReviewReducer(
  state: RatingReviewState,
  action: RatingReviewAction,
): RatingReviewState {
  switch (action.type) {
    case "drafted":
      return { drafts: { ...state.drafts, [action.memberId]: action.tenths } };
    case "sent": {
      const sent = new Set(action.memberIds);
      return {
        drafts: Object.fromEntries(Object.entries(state.drafts).filter(([id]) => !sent.has(id))),
      };
    }
  }
}

export function draftOf(state: RatingReviewState, memberId: string): LevelTenths | undefined {
  return state.drafts[memberId];
}
