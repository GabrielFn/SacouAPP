import { useEffect } from "react";

import { useServices } from "../../../services/services-context";
import { KEEP_AWAKE_TAG } from "../court.data";

/**
 * The screen stays on while the court is open. It is called by the layout that holds every route of
 * the court, so it is on from the first frame to the last, including the menu, and off as soon as
 * the court closes.
 */
export function useKeepAwakeWhileMounted(): void {
  const { screenAwake } = useServices();
  useEffect(() => {
    screenAwake.activate(KEEP_AWAKE_TAG);
    return () => {
      screenAwake.deactivate(KEEP_AWAKE_TAG);
    };
  }, [screenAwake]);
}
