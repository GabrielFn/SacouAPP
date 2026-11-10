import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";

import type { NetworkStatus } from "../services/api/network-status";

/** Unknown reachability (`null`) counts as online: the request itself says when there is no network. */
function isOnline(state: NetInfoState): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}

/**
 * NetInfo behind the port (E4.2, D4). A native module new in E4.2: it needs a new test APK.
 * Until the first event arrives, the app takes itself as online.
 */
export function createNetInfoNetworkStatus(): NetworkStatus {
  const last = { value: true };
  NetInfo.addEventListener((state) => {
    last.value = isOnline(state);
  });
  return {
    isOnline: () => last.value,
    subscribe: (listener) =>
      NetInfo.addEventListener((state) => {
        listener(isOnline(state));
      }),
  };
}
