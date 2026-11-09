import type { BackGuard } from "../features/court/ports/back-guard";

export interface FakeBackGuard extends BackGuard {
  /** Is the back button blocked right now? */
  isBlocking(): boolean;
}

export function createFakeBackGuard(): FakeBackGuard {
  const blockers = { value: 0 };
  return {
    block() {
      blockers.value += 1;
      const released = { value: false };
      return () => {
        if (!released.value) {
          released.value = true;
          blockers.value -= 1;
        }
      };
    },
    isBlocking: () => blockers.value > 0,
  };
}
