/**
 * Locks the way the phone turns. The court is always on its side and the rest of the app is
 * upright, so there is no "unlock": going back means locking portrait again (ADR 0049).
 */
export interface ScreenOrientation {
  lockLandscape(): Promise<void>;
  lockPortrait(): Promise<void>;
}
