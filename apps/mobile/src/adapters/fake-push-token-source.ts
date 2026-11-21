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
  const token = { value: initial };
  const unregistered = { value: 0 };
  const failing = { value: false };
  const listeners = { value: [] as readonly ((token: PushToken) => void)[] };
  return {
    getToken: () => Promise.resolve(token.value),
    onTokenChange(listener) {
      listeners.value = [...listeners.value, listener];
      return () => {
        listeners.value = listeners.value.filter((other) => other !== listener);
      };
    },
    unregister: () => {
      unregistered.value += 1;
      return failing.value ? Promise.reject(new Error("unregister failed")) : Promise.resolve();
    },
    set(next) {
      token.value = next;
    },
    change(next) {
      token.value = next;
      listeners.value.forEach((listener) => {
        listener(next);
      });
    },
    unregistered: () => unregistered.value,
    failUnregister() {
      failing.value = true;
    },
  };
}
