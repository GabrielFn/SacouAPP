import type { CacheSession } from "../services/query/cache-persister";

export interface FakeCacheSession extends CacheSession {
  /** How many times the session was cleared. */
  readonly cleared: () => number;
}

export function createFakeCacheSession(): FakeCacheSession {
  const state = { value: 0 };
  return {
    clearSession: () => {
      state.value += 1;
      return Promise.resolve();
    },
    cleared: () => state.value,
  };
}
