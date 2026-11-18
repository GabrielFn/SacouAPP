import type { Member } from "../../../services/api/sacou-api";
import { strings } from "../../../strings/pt-BR";
import type { CourtSummaryLookup } from "./court-summary-lookup";
import {
  backdropOf,
  takeoverCardTexts,
  writerNameOf,
  type BackdropScore,
  type TakeoverCardTexts,
} from "./takeover-texts";
import type { TakeoverFailure, TakeoverState } from "./takeover.reducer";

/** What the button of the card does now (D5): read, confirm, wait, or try again. */
export type TakeOverAction =
  | { readonly kind: "reading" }
  | { readonly kind: "confirm" }
  | { readonly kind: "busy"; readonly label: string }
  | { readonly kind: "retry" }
  | { readonly kind: "none" };

export interface TakeOverInput {
  readonly lookup: CourtSummaryLookup | undefined;
  readonly refreshing: boolean;
  readonly members: readonly Member[] | undefined;
  readonly state: TakeoverState;
}

/** What screen 09a draws, derived from the summary and the flow (never stored). */
export interface TakeOverView {
  readonly card: TakeoverCardTexts | null;
  readonly backdrop: BackdropScore | null;
  readonly notice: string | null;
  readonly action: TakeOverAction;
}

const { takeover } = strings.court;

/** Trying again cannot help a court that took all its changes of phone. */
function failureAction(reason: TakeoverFailure): TakeOverAction {
  return reason === "writers-limit" ? { kind: "none" } : { kind: "retry" };
}

function flowOf(
  state: TakeoverState,
  refreshing: boolean,
): Pick<TakeOverView, "notice" | "action"> {
  switch (state.status) {
    case "confirming":
      return {
        notice: state.streamChanged ? takeover.streamChanged : null,
        action: refreshing ? { kind: "reading" } : { kind: "confirm" },
      };
    case "importing":
      return {
        notice: null,
        action: {
          kind: "busy",
          label:
            state.total === 0 ? takeover.loading : takeover.importing(state.imported, state.total),
        },
      };
    case "taking-over":
    case "done":
      return { notice: null, action: { kind: "busy", label: takeover.loading } };
    case "failed":
      return { notice: takeover.failures[state.reason], action: failureAction(state.reason) };
  }
}

export function takeOverView(input: TakeOverInput, nowMs: number): TakeOverView {
  const { lookup } = input;
  if (lookup === undefined) {
    return { card: null, backdrop: null, notice: null, action: { kind: "reading" } };
  }
  if (lookup.status === "none") {
    return {
      card: null,
      backdrop: null,
      notice: takeover.failures["not-found"],
      action: { kind: "none" },
    };
  }
  if (lookup.status === "failed") {
    return {
      card: null,
      backdrop: null,
      notice: takeover.failures[lookup.reason],
      action: failureAction(lookup.reason),
    };
  }
  const { summary } = lookup;
  return {
    card: takeoverCardTexts(summary, writerNameOf(summary, input.members), nowMs),
    backdrop: backdropOf(summary),
    ...flowOf(input.state, input.refreshing),
  };
}
