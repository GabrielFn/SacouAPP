import { useEffect, useReducer, type Dispatch } from "react";

import { useServices } from "../../../services/services-context";
import {
  batteryWarningReducer,
  initialBatteryWarning,
  type BatteryWarningAction,
  type BatteryWarningState,
} from "../model/battery-warning.reducer";
import type { BatteryMonitor } from "../ports/battery-monitor";

export interface BatteryWarning {
  readonly state: BatteryWarningState;
  readonly dismiss: () => void;
}

/** Feeds the readings of the monitor to the reducer; the returned function lets go of the monitor. */
export function watchBattery(
  monitor: BatteryMonitor,
  dispatch: Dispatch<BatteryWarningAction>,
): () => void {
  return monitor.subscribe(({ level, charging }) => {
    dispatch({ type: "reading-received", level, charging });
  });
}

/** Listens to the battery for as long as the court layout is mounted, and keeps the one-time warning. */
export function useBatteryWarning(): BatteryWarning {
  const { batteryMonitor } = useServices();
  const [state, dispatch] = useReducer(batteryWarningReducer, initialBatteryWarning);
  useEffect(() => watchBattery(batteryMonitor, dispatch), [batteryMonitor]);
  return {
    state,
    dismiss: () => {
      dispatch({ type: "dismissed" });
    },
  };
}
