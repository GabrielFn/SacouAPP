import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { QueryClient } from "@tanstack/react-query";
import type {
  PersistedClient,
  Persister,
  PersistQueryClientOptions,
} from "@tanstack/react-query-persist-client";

import type { KeyValueStore } from "./key-value-store";
import { cacheBuster, PERSISTED_CACHE_MAX_AGE_MS, shouldPersistQuery } from "./persist-policy";

/** The one row of the persisted cache. */
export const CACHE_STORAGE_KEY = "sacou-query-cache";
const SAVE_THROTTLE_MS = 1_000;
/** Written for a cache with nothing to keep: the store removes the row instead (see below). */
const NOTHING_KEPT = "";

function serialize(client: PersistedClient): string {
  const { queries, mutations } = client.clientState;
  return queries.length === 0 && mutations.length === 0 ? NOTHING_KEPT : JSON.stringify(client);
}

/**
 * The throttled save always writes the latest state, so after `clearSession` the last write is the empty
 * cache: this store turns it into a removal, and the file keeps no row (Q4).
 */
function withoutEmptyRows(store: KeyValueStore): KeyValueStore {
  return {
    getItem: (key) => store.getItem(key),
    setItem: (key, value) =>
      value === NOTHING_KEPT ? store.removeItem(key) : store.setItem(key, value),
    removeItem: (key) => store.removeItem(key),
  };
}

export function createCachePersister(
  store: KeyValueStore,
  throttleTime: number = SAVE_THROTTLE_MS,
): Persister {
  return createAsyncStoragePersister({
    storage: withoutEmptyRows(store),
    key: CACHE_STORAGE_KEY,
    throttleTime,
    serialize,
  });
}

/** What the provider and the tests give the persister: the allow list, the age and the buster (D6). */
export function persistOptions(
  persister: Persister,
  appVersion: string,
): Omit<PersistQueryClientOptions, "queryClient"> {
  return {
    persister,
    maxAge: PERSISTED_CACHE_MAX_AGE_MS,
    buster: cacheBuster(appVersion),
    dehydrateOptions: {
      shouldDehydrateQuery: shouldPersistQuery,
      shouldDehydrateMutation: () => false,
    },
  };
}

/** Sign-out and an expired session (E4.3): nothing of this account stays, in memory or on disk. */
export interface CacheSession {
  clearSession(): Promise<void>;
}

export function createCacheSession(client: QueryClient, persister: Persister): CacheSession {
  return {
    async clearSession() {
      client.clear();
      await persister.removeClient();
    },
  };
}
