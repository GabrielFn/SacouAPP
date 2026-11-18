import type { PointKind } from "@sacou/match-engine";

/** The kinds the sheet picks before a player: an error of the opponent is its own button. */
export type AuthoredPointKind = Exclude<PointKind, "opponent-error">;

export const DEFAULT_POINT_KIND: AuthoredPointKind = "attack";

/**
 * What screen 31 keeps: the point it asks about, the kind picked and the points still to ask about
 * ("Preencher" on screen 25 goes through them, oldest first). The rally and the players come from the
 * log, so the point is validated on every read: an undone point closes the sheet.
 */
export type AttributionState =
  | { readonly status: "closed" }
  | {
      readonly status: "open";
      readonly pointEventId: string;
      readonly kind: AuthoredPointKind;
      readonly next: readonly string[];
      /** Why the last answer did nothing, in words. */
      readonly refusal: string | null;
    };

export type AttributionAction =
  /** A point was scored, or "Autor" (24) or "Preencher" (25) was tapped: ask about these, in order. */
  | { readonly type: "opened"; readonly pointEventIds: readonly string[] }
  | { readonly type: "kind-chosen"; readonly kind: AuthoredPointKind }
  /** The answer was recorded, or "Pular": the next point of the list, or none. */
  | { readonly type: "answered" }
  | { readonly type: "skipped" }
  | { readonly type: "command-refused"; readonly text: string }
  | { readonly type: "closed" };

export const CLOSED_ATTRIBUTION: AttributionState = { status: "closed" };

function openOn(pointEventIds: readonly string[]): AttributionState {
  const [first, ...next] = pointEventIds;
  return first === undefined
    ? CLOSED_ATTRIBUTION
    : { status: "open", pointEventId: first, kind: DEFAULT_POINT_KIND, next, refusal: null };
}

export function attributionReducer(
  state: AttributionState,
  action: AttributionAction,
): AttributionState {
  switch (action.type) {
    case "opened":
      // A new point replaces the question about the last one, which stays without an author.
      return openOn(action.pointEventIds);
    case "kind-chosen":
      return state.status === "open" ? { ...state, kind: action.kind, refusal: null } : state;
    case "answered":
    case "skipped":
      return state.status === "open" ? openOn(state.next) : state;
    case "command-refused":
      return state.status === "open" ? { ...state, refusal: action.text } : state;
    case "closed":
      return CLOSED_ATTRIBUTION;
  }
}
