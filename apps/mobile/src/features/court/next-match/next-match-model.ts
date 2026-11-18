import {
  planNextMatch,
  type CourtSessionState,
  type FinishedMatch,
  type GroupSettings,
  type NextMatchPlan,
  type QueueCommandError,
} from "@sacou/match-engine";

import type { CourtRoster } from "../ports/court-roster";
import type { NextMatchDraft } from "../ports/next-match-draft-store";
import { manualPicks, picksComplete, type ManualPick } from "./match-end-selectors";
import { arrivalOrderOf, nextMatchInput, type ArrivalEntry } from "./next-match-input";

export interface NextMatchModelInput {
  /** The state right after the match ended. */
  readonly state: CourtSessionState;
  readonly settings: GroupSettings;
  readonly confirmed: readonly ArrivalEntry[];
  readonly draft: NextMatchDraft;
  readonly roster: CourtRoster;
}

/** What screen 11 proposes: nothing to plan, the plan turned down, or the plan with its picks. */
export type NextMatchModel =
  | { readonly kind: "none" }
  | { readonly kind: "refused"; readonly match: FinishedMatch; readonly code: string }
  | {
      readonly kind: "planned";
      readonly match: FinishedMatch;
      /** The plan, or with the picks of `manual` still open, the preview by order of arrival. */
      readonly plan: NextMatchPlan;
      readonly picks: readonly ManualPick[];
      readonly canConfirm: boolean;
    };

function codeOf(error: QueueCommandError): string {
  return error.code;
}

function plan(input: NextMatchModelInput, match: FinishedMatch, settings: GroupSettings) {
  const context = {
    arrivalOrder: arrivalOrderOf(input.confirmed, match, input.state.queue),
    draft: input.draft,
    winner: match.winner,
  };
  return planNextMatch(input.state, nextMatchInput(settings, context));
}

/**
 * The plan of the next match (D6, D7). With the criterion `manual`, the preview by order of arrival
 * says how many leave each team; until the picks are complete, it is what the screen shows.
 */
export function nextMatchModel(input: NextMatchModelInput): NextMatchModel {
  const match = input.state.currentMatch === null ? input.state.finishedMatches.at(-1) : undefined;
  if (match === undefined) return { kind: "none" };
  const { settings } = input;
  const manual = settings.queue.exitCriterion === "manual";
  const preview = manual
    ? plan(input, match, {
        ...settings,
        queue: { ...settings.queue, exitCriterion: "arrival-order" },
      })
    : plan(input, match, settings);
  if (!preview.ok) return { kind: "refused", match, code: codeOf(preview.error) };
  const picks = manual ? manualPicks(match, preview.value, input.roster) : [];
  if (!picksComplete(picks, input.draft.chosen)) {
    return { kind: "planned", match, plan: preview.value, picks, canConfirm: false };
  }
  const planned = manual ? plan(input, match, settings) : preview;
  return planned.ok
    ? { kind: "planned", match, plan: planned.value, picks, canConfirm: true }
    : { kind: "refused", match, code: codeOf(planned.error) };
}
