import type { ReducedMotion } from "../features/court/ports/reduced-motion";
import { createListeners } from "./listeners";

export interface FakeReducedMotion extends ReducedMotion {
  set(reduced: boolean): void;
}

export function createFakeReducedMotion(reduced = false): FakeReducedMotion {
  const state = { value: reduced };
  const listeners = createListeners();
  return {
    getSnapshot: () => state.value,
    subscribe: listeners.add,
    set(next) {
      state.value = next;
      listeners.notify();
    },
  };
}
