import { useEffect, useReducer } from "react";

import { useServices } from "../../../services/services-context";
import {
  batteryWarningReducer,
  initialBatteryWarning,
  type BatteryWarningState,
} from "../model/battery-warning.reducer";

export interface BatteryWarning {
  readonly state: BatteryWarningState;
  readonly dismiss: () => void;
}

/** Listens to the battery for as long as the court layout is mounted, and keeps the one-time warning. */
export function useBatteryWarning(): BatteryWarning {
  const { batteryMonitor } = useServices();
  const [state, dispatch] = useReducer(batteryWarningReducer, initialBatteryWarning);
  useEffect(
    () =>
      batteryMonitor.subscribe(({ level, charging }) => {
        dispatch({ type: "reading-received", level, charging });
      }),
    [batteryMonitor],
  );
  return {
    state,
    dismiss: () => {
      dispatch({ type: "dismissed" });
    },
  };
}
