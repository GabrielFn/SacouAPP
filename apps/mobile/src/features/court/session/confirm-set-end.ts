import type { TeamSide } from "@sacou/match-engine";

import type { CourtFeedback } from "../ports/court-feedback";
import type { PlayCommand } from "./command-drafts";
import type { CommandResult } from "./court-session-controller";

export interface ConfirmSetEndDeps {
  readonly dispatch: (command: PlayCommand) => Promise<CommandResult>;
  readonly feedback: CourtFeedback;
}

/**
 * Confirms the end of the set (with the toss of the deciding set when `firstServer` is given). When
 * the engine turns the confirmation down, the phone buzzes "refused"; the result says why.
 */
export async function confirmSetEnd(
  { dispatch, feedback }: ConfirmSetEndDeps,
  firstServer?: TeamSide,
): Promise<CommandResult> {
  const command: PlayCommand =
    firstServer === undefined
      ? { type: "confirm-set-end" }
      : { type: "confirm-set-end", firstServer };
  const result = await dispatch(command);
  if (!result.ok) {
    feedback.play("refused");
  }
  return result;
}
