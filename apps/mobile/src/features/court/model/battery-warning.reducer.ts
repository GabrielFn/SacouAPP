import { BATTERY_WARNING_LEVEL } from "../court.data";

/** `showing` keeps the level that opened the warning: it is the only place that level lives. */
export type BatteryWarningState =
  | { readonly status: "watching" }
  | { readonly status: "showing"; readonly level: number }
  | { readonly status: "done" };

export type BatteryWarningAction =
  | { readonly type: "reading-received"; readonly level: number | null; readonly charging: boolean }
  | { readonly type: "dismissed" };

export const initialBatteryWarning: BatteryWarningState = { status: "watching" };

const DONE: BatteryWarningState = { status: "done" };

function isLow(level: number | null, charging: boolean): level is number {
  return level !== null && level < BATTERY_WARNING_LEVEL && !charging;
}

/** Shows once per open court: "Entendi" or the charger closes it for good. */
export function batteryWarningReducer(
  state: BatteryWarningState,
  action: BatteryWarningAction,
): BatteryWarningState {
  switch (state.status) {
    case "watching":
      return action.type === "reading-received" && isLow(action.level, action.charging)
        ? { status: "showing", level: action.level }
        : state;
    case "showing":
      if (action.type === "dismissed") return DONE;
      return action.charging ? DONE : state;
    case "done":
      return state;
  }
}
