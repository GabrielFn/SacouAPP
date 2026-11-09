import type { ReducedMotion } from "../features/court/ports/reduced-motion";

export interface FakeReducedMotion extends ReducedMotion {
  set(reduced: boolean): void;
}

export function createFakeReducedMotion(reduced = false): FakeReducedMotion {
  const state = { value: reduced };
  const listeners = { value: [] as readonly (() => void)[] };
  return {
    getSnapshot: () => state.value,
    subscribe(listener) {
      listeners.value = [...listeners.value, listener];
      return () => {
        listeners.value = listeners.value.filter((known) => known !== listener);
      };
    },
    set(next) {
      state.value = next;
      listeners.value.forEach((listener) => {
        listener();
      });
    },
  };
}
