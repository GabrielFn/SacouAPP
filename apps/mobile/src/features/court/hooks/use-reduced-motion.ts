import { useSyncExternalStore } from "react";

import { useServices } from "../../../services/services-context";

/** True when the person asked the phone to remove animations. */
export function useReducedMotion(): boolean {
  const { reducedMotion } = useServices();
  return useSyncExternalStore(reducedMotion.subscribe, reducedMotion.getSnapshot);
}
