import type { MatchStartedPayload } from "@sacou/match-engine";
import { err, ok, type Result } from "@sacou/volley-rules";

import type { CommandError, LoadFailureCode } from "./court-errors";
import {
  createCourtSessionController,
  type CourtSessionControllerDeps,
} from "./court-session-controller";

export type StartCourtMatchError =
  | CommandError
  | { readonly code: "load-failed"; readonly cause: LoadFailureCode };

export interface StartedCourtMatch {
  readonly route: string;
}

export function courtRoute(courtSessionId: string): string {
  return `/court/${courtSessionId}`;
}

/**
 * The one public way to begin a match: opens the session if it does not exist, runs `startMatch`
 * and stores the `MatchStarted`. The development screen calls it in E4.9 and the pre-game (E4.7)
 * will.
 */
export async function startCourtMatch(
  deps: CourtSessionControllerDeps,
  input: MatchStartedPayload,
): Promise<Result<StartedCourtMatch, StartCourtMatchError>> {
  const opened = await deps.log.openSession(deps.courtSessionId);
  if (!opened.ok) {
    return err({ code: "load-failed", cause: opened.error.code });
  }
  const controller = createCourtSessionController(deps);
  await controller.whenIdle();
  const snapshot = controller.getSnapshot();
  if (snapshot.status === "failed") {
    return err({ code: "load-failed", cause: snapshot.code });
  }
  const started = await controller.dispatch({ type: "start-match", input });
  return started.ok ? ok({ route: courtRoute(deps.courtSessionId) }) : started;
}
