import { useSyncExternalStore } from "react";

import { useServices } from "../services-context";

/** Whether the phone has a network now, read from the injected `NetworkStatus` (never NetInfo directly). */
export function useOnline(): boolean {
  const { networkStatus } = useServices();
  return useSyncExternalStore(
    (onChange) => networkStatus.subscribe(onChange),
    () => networkStatus.isOnline(),
  );
}
