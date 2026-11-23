import { useEffect, useRef } from "react";

import { useServices } from "../services/services-context";
import { backdropAction } from "./backdrop-dismiss";

/** The tap on the backdrop of a sheet: closes the keyboard, ignores the tap that follows it, or closes the sheet. */
export function useBackdropPress(onClose: () => void): () => void {
  const { keyboard, clock } = useServices();
  const hiddenAt = useRef(Number.NEGATIVE_INFINITY);
  useEffect(
    () =>
      keyboard.subscribe((visible) => {
        if (!visible) hiddenAt.current = clock.now();
      }),
    [keyboard, clock],
  );
  return () => {
    const action = backdropAction(keyboard.isVisible(), clock.now() - hiddenAt.current);
    if (action === "dismiss-keyboard") keyboard.dismiss();
    else if (action === "close-sheet") onClose();
  };
}
