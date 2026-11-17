import type { MemberId } from "@sacou/match-engine";

import type { Round } from "../../../services/api/sacou-api";
import type { DrawLock } from "../model/draw-arrangement";
import {
  drawFlowReducer,
  lockAcrossTeams,
  type DrawFlowAction,
  type DrawFlowState,
} from "../model/draw-flow.reducer";
import { drawRequest } from "../model/draw-request";
import type { DrawVariables } from "../queries/draw-mutation";

export interface DrawRunOptions {
  readonly onError: () => void;
  readonly onSettled: () => void;
}

/**
 * What the actions of screen 07 need from the hook: the state of this render, the round of the cache,
 * the dispatch of the reducer and the mutation. `claim` is the guard against a double tap in the same
 * frame: it says yes once until the draw settles.
 */
export interface DrawActionDeps {
  readonly state: DrawFlowState;
  readonly round: Pick<Round, "going">;
  readonly dispatch: (action: DrawFlowAction) => void;
  readonly mutate: (variables: DrawVariables, options: DrawRunOptions) => void;
  readonly online: boolean;
  readonly claim: () => boolean;
  readonly release: () => void;
}

/** Asks the server for a draw from this state; a lock across teams that is refused goes back out. */
export function runDraw(
  deps: DrawActionDeps,
  state: DrawFlowState,
  lockToUndo: DrawLock | null = null,
): boolean {
  if (!deps.online) {
    deps.dispatch({ type: "offline-refused" });
    return false;
  }
  const body = drawRequest(state, deps.round);
  if (!body.ok || !deps.claim()) return false;
  deps.mutate(
    {
      body: body.value,
      deliver: (answer) => {
        deps.dispatch({ type: "drawn", answer });
      },
    },
    {
      onError: () => {
        if (lockToUndo !== null) deps.dispatch({ type: "lock-undone", lock: lockToUndo });
      },
      onSettled: deps.release,
    },
  );
  return true;
}

/** A tap on a name. A lock of two teams asks for a new draw with the locks at once (D3, D5). */
export function tapPlayer(deps: DrawActionDeps, memberId: MemberId): void {
  const action: DrawFlowAction = { type: "player-tapped", memberId };
  const next = drawFlowReducer(deps.state, action);
  deps.dispatch(action);
  const across = lockAcrossTeams(deps.state, next);
  if (across !== null && !runDraw(deps, next, across)) {
    deps.dispatch({ type: "lock-undone", lock: across });
  }
}

/** "Sortear de novo": the selection clears, the locks and the reserves of now go along. */
export function redraw(deps: DrawActionDeps): void {
  if (runDraw(deps, deps.state)) deps.dispatch({ type: "selection-cleared" });
}
