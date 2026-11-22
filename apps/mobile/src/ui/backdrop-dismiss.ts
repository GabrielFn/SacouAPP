/**
 * After the keyboard goes away (the Android back button) the sheet drops while the finger is still on
 * its way, so the touch lands on the backdrop: for this long a tap there does not count (R98 part 3).
 */
export const BACKDROP_GRACE_MS = 400;

export type BackdropAction = "dismiss-keyboard" | "ignore" | "close-sheet";

/**
 * The rule of the backdrop of a sheet: with the keyboard open the tap only closes the keyboard, and a
 * tap right after the keyboard closed is ignored; otherwise it closes the sheet.
 */
export function backdropAction(
  keyboardVisible: boolean,
  msSinceKeyboardHidden: number,
): BackdropAction {
  if (keyboardVisible) return "dismiss-keyboard";
  return msSinceKeyboardHidden < BACKDROP_GRACE_MS ? "ignore" : "close-sheet";
}
