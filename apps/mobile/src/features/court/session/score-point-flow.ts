import { scoredPointId } from "../attribution/scored-point";
import type { CourtFeedback } from "../ports/court-feedback";
import type { PlayCommand } from "./command-drafts";
import type { CommandResult } from "./court-session-controller";

export interface ScorePointDeps {
  readonly dispatch: (command: PlayCommand) => Promise<CommandResult>;
  readonly feedback: Pick<CourtFeedback, "play">;
  /** "Ponto individual" of the round: the next question is "De quem foi?" (screen 31). */
  readonly individualPoints: boolean;
  readonly openAttribution: (pointEventIds: readonly string[]) => void;
}

/** A tap on a zone: the point, then "De quem foi?" when the round asks for authors (D10). */
export async function scorePointAndAsk(deps: ScorePointDeps, team: "a" | "b"): Promise<void> {
  const result = await deps.dispatch({ type: "score-point", team });
  if (!result.ok) {
    deps.feedback.play("refused");
    return;
  }
  const pointEventId = scoredPointId(result.value.written);
  if (deps.individualPoints && pointEventId !== null) {
    deps.openAttribution([pointEventId]);
  }
}
