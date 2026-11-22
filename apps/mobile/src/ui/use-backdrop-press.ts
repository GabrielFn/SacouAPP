import { useEffect, useRef } from "react";

import { backdropAction } from "./backdrop-dismiss";
import { useKeyboardVisibility } from "./keyboard-visibility";

/** The tap on the backdrop of a sheet: closes the keyboard, ignores the tap that follows it, or closes the sheet. */
export function useBackdropPress(onClose: () => void): () => void {
  const keyboard = useKeyboardVisibility();
  const hiddenAt = useRef(Number.NEGATIVE_INFINITY);
  useEffect(
    () =>
      keyboard.subscribe((visible) => {
        if (!visible) hiddenAt.current = Date.now();
      }),
    [keyboard],
  );
  return () => {
    const action = backdropAction(keyboard.isVisible(), Date.now() - hiddenAt.current);
    if (action === "dismiss-keyboard") keyboard.dismiss();
    else if (action === "close-sheet") onClose();
  };
}
