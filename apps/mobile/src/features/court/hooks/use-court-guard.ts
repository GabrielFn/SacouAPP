import { useCallback, useEffect, useReducer } from "react";

import { useServices } from "../../../services/services-context";
import {
  canScore,
  courtGuardReducer,
  INITIAL_COURT_GUARD,
  isBackBlocked,
  isToastVisible,
  nextDeadline,
} from "../guard/court-guard.reducer";

export interface UseCourtGuard {
  readonly toastVisible: boolean;
  /** Is the back button of the phone blocked, with the court in front or not. */
  readonly backBlocked: (focused: boolean) => boolean;
  /** Starts the wait after a tap that went through; `false` while the zones are still waiting. */
  readonly acceptPoint: () => boolean;
  readonly recordPoint: () => void;
  readonly acceptUndo: () => void;
}

/**
 * The wait after a point and the toast. The state is the reducer's; one timer wakes the
 * component when the next thing expires, and the reducer clears it.
 */
export function useCourtGuard(): UseCourtGuard {
  const { clock } = useServices();
  const [state, dispatch] = useReducer(courtGuardReducer, INITIAL_COURT_GUARD);
  const deadline = nextDeadline(state);

  useEffect(() => {
    if (deadline === null) {
      return undefined;
    }
    const timer = setTimeout(
      () => {
        dispatch({ type: "tick", at: clock.now() });
      },
      Math.max(0, deadline - clock.now()),
    );
    return () => {
      clearTimeout(timer);
    };
  }, [deadline, clock]);

  const acceptPoint = useCallback(() => {
    const now = clock.now();
    if (!canScore(state, now)) {
      return false;
    }
    dispatch({ type: "point-accepted", at: now });
    return true;
  }, [state, clock]);

  return {
    toastVisible: isToastVisible(state, clock.now()),
    backBlocked: (focused) => isBackBlocked(state, focused),
    acceptPoint,
    recordPoint: useCallback(() => {
      dispatch({ type: "point-recorded", at: clock.now() });
    }, [clock]),
    acceptUndo: useCallback(() => {
      dispatch({ type: "undo-accepted" });
    }, []),
  };
}
