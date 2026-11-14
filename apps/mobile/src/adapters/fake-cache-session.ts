import type { CacheSession } from "../services/query/cache-persister";

export interface FakeCacheSession extends CacheSession {
  /** How many times the session was cleared. */
  readonly cleared: () => number;
}

export function createFakeCacheSession(): FakeCacheSession {
  const state = { count: 0 };
  return {
    clearSession: () => {
      state.count += 1;
      return Promise.resolve();
    },
    cleared: () => state.count,
  };
}
