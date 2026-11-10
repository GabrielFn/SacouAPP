import type { NetworkStatus } from "../services/api/network-status";

export interface FakeNetworkStatus extends NetworkStatus {
  /** The manual switch of the tests. */
  set(online: boolean): void;
}

type Listener = (online: boolean) => void;

export function createFakeNetworkStatus(online = true): FakeNetworkStatus {
  const state = { value: { online, listeners: [] as readonly Listener[] } };
  return {
    isOnline: () => state.value.online,
    subscribe(listener) {
      state.value = { ...state.value, listeners: [...state.value.listeners, listener] };
      return () => {
        state.value = {
          ...state.value,
          listeners: state.value.listeners.filter((other) => other !== listener),
        };
      };
    },
    set(next) {
      state.value = { ...state.value, online: next };
      state.value.listeners.forEach((listener) => {
        listener(next);
      });
    },
  };
}
