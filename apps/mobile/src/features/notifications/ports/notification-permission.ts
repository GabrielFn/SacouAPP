/**
 * What the phone says about the notifications of the app: given, still possible to ask, or refused for
 * good (only the settings of the phone turn it on then).
 */
export type PermissionAnswer = "granted" | "askable" | "blocked";

/** The system permission of the notifications (E3.11). Screens and hooks never import the SDK. */
export interface NotificationPermission {
  status(): Promise<PermissionAnswer>;
  /** Shows the system question when it still can; otherwise answers what the phone already says. */
  request(): Promise<PermissionAnswer>;
  /** The settings page of the app, for a permission refused for good. */
  openSettings(): Promise<void>;
}
