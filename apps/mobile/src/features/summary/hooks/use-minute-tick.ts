import { useEffect, useReducer } from "react";

import { wallClockNow } from "../../../services/api/wall-clock";
import type { Scheduler } from "../../../services/scheduler/scheduler";

export const MINUTE_MS = 60_000;

/**
 * The wall clock of the phone, drawn again once a minute while `active`, so "fecha em 23 h" ages with
 * the screen open. The counter only forces the redraw: the time is read on each render, never stored.
 */
export function useMinuteTick(scheduler: Scheduler, active: boolean): number {
  const [ticks, redraw] = useReducer((count: number) => count + 1, 0);
  useEffect(
    () => (active ? scheduler.after(MINUTE_MS, redraw) : undefined),
    [scheduler, active, ticks],
  );
  return wallClockNow();
}
