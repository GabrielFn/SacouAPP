import type { PermissionAnswer } from "../ports/notification-permission";

/**
 * The card of the permission on screen 28 (E3.11, part 3): not read yet, the question on screen, given,
 * still possible to ask, or refused for good ("Ativar" opens the settings of the phone then).
 */
export type PushPermissionState = "unknown" | "asking" | "granted" | "denied" | "blocked";

export type PushPermissionAction =
  | { readonly type: "status-read"; readonly answer: PermissionAnswer }
  | { readonly type: "request-started" }
  | { readonly type: "request-answered"; readonly answer: PermissionAnswer };

export const INITIAL_PUSH_PERMISSION: PushPermissionState = "unknown";

function stateOf(answer: PermissionAnswer): PushPermissionState {
  switch (answer) {
    case "granted":
      return "granted";
    case "askable":
      return "denied";
    case "blocked":
      return "blocked";
  }
}

/** Pure and with no effect: asking the system and opening the settings are the hook's (frontend.md, rule 4). */
export function pushPermissionReducer(
  state: PushPermissionState,
  action: PushPermissionAction,
): PushPermissionState {
  switch (action.type) {
    case "status-read":
      // A read that lands while the question is on screen is older than the answer to come.
      return state === "asking" ? state : stateOf(action.answer);
    case "request-started":
      return state === "denied" ? "asking" : state;
    case "request-answered":
      return state === "asking" ? stateOf(action.answer) : state;
  }
}

/** What "Ativar" does in each state: the system question, the settings of the phone, or nothing. */
export type PermissionActivation = "request" | "open-settings" | "none";

export function activationOf(state: PushPermissionState): PermissionActivation {
  switch (state) {
    case "denied":
      return "request";
    case "blocked":
      return "open-settings";
    case "unknown":
    case "asking":
    case "granted":
      return "none";
  }
}

/** The card shows while the pushes are off, and hides while it is not known yet (no blink when given). */
export function showsPermissionCard(state: PushPermissionState): boolean {
  return state === "denied" || state === "asking" || state === "blocked";
}
