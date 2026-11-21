import type { PushToken, PushTokenSource } from "../features/notifications/ports/push-token-source";

export interface FakePushTokenSource extends PushTokenSource {
  /** The token the system gives from now on (`null`: none). */
  set(token: PushToken | null): void;
  /** The system replaces the token and tells the listeners. */
  change(token: PushToken): void;
  unregistered(): number;
  /** Makes `unregister` reject from now on. */
  failUnregister(): void;
}

export const FAKE_PUSH_TOKEN: PushToken = {
  token: "ExponentPushToken[fake-token-for-tests]",
  platform: "android",
};

export function createFakePushTokenSource(
  initial: PushToken | null = FAKE_PUSH_TOKEN,
): FakePushTokenSource {
  const state = { token: initial, unregistered: 0, failing: false };
  const listeners = { value: [] as readonly ((token: PushToken) => void)[] };
  return {
    getToken: () => Promise.resolve(state.token),
    onTokenChange(listener) {
      listeners.value = [...listeners.value, listener];
      return () => {
        listeners.value = listeners.value.filter((other) => other !== listener);
      };
    },
    unregister: () => {
      state.unregistered += 1;
      return state.failing ? Promise.reject(new Error("unregister failed")) : Promise.resolve();
    },
    set(token) {
      state.token = token;
    },
    change(token) {
      state.token = token;
      listeners.value.forEach((listener) => {
        listener(token);
      });
    },
    unregistered: () => state.unregistered,
    failUnregister() {
      state.failing = true;
    },
  };
}
