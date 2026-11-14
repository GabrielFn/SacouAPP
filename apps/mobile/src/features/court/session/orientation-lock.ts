import type { ScreenOrientation } from "../ports/screen-orientation";

/**
 * Turns the phone to landscape and returns the function that puts it back upright. A phone that
 * refuses the lock is not a reason to stop the match: the layout follows the window, so the court
 * opens upright (the fallback layout) and works the same.
 */
export function lockLandscapeUntilReleased(orientation: ScreenOrientation): () => void {
  orientation.lockLandscape().catch(() => undefined);
  return () => {
    orientation.lockPortrait().catch(() => undefined);
  };
}
