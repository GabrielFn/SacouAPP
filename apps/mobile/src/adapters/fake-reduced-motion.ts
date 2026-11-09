import type { ReducedMotion } from "../features/court/ports/reduced-motion";

export interface FakeReducedMotion extends ReducedMotion {
  set(reduced: boolean): void;
}

export function createFakeReducedMotion(reduced = false): FakeReducedMotion {
  const state = { value: reduced };
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => state.value,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set(next) {
      state.value = next;
      listeners.forEach((listener) => {
        listener();
      });
    },
  };
}
