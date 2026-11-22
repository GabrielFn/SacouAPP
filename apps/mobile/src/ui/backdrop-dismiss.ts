import type { KeyboardVisibility } from "./keyboard-visibility";

/**
 * After the keyboard goes away (the Android back button) the sheet drops while the finger is still on
 * its way, so the touch lands on the backdrop: for this long a tap there does not count (R98 part 3).
 */
export const BACKDROP_GRACE_MS = 400;

export interface BackdropDismiss {
  /** The tap on the backdrop: closes the keyboard, or the sheet when the keyboard is not involved. */
  onBackdropPress(): void;
  /** Stops listening to the keyboard. */
  release(): void;
}

/**
 * The rule of the backdrop of a sheet: with the keyboard open the tap only closes the keyboard, and a
 * tap right after the keyboard closed is ignored; otherwise it closes the sheet.
 */
export function createBackdropDismiss(
  keyboard: KeyboardVisibility,
  onClose: () => void,
  now: () => number,
): BackdropDismiss {
  const hiddenAt = { value: Number.NEGATIVE_INFINITY };
  const stopListening = keyboard.subscribe((visible) => {
    if (!visible) hiddenAt.value = now();
  });
  return {
    onBackdropPress() {
      if (keyboard.isVisible()) {
        keyboard.dismiss();
        return;
      }
      if (now() - hiddenAt.value < BACKDROP_GRACE_MS) return;
      onClose();
    },
    release: stopListening,
  };
}
