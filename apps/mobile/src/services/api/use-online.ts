import { useCallback, useSyncExternalStore } from "react";

import { useServices } from "../services-context";

/** Whether the phone has a network now, read from the injected `NetworkStatus` (never NetInfo directly). */
export function useOnline(): boolean {
  const { networkStatus } = useServices();
  // A stable `subscribe`: a new one each render would make React unsubscribe and subscribe again.
  const subscribe = useCallback(
    (onChange: () => void) => networkStatus.subscribe(onChange),
    [networkStatus],
  );
  const snapshot = useCallback(() => networkStatus.isOnline(), [networkStatus]);
  return useSyncExternalStore(subscribe, snapshot);
}
