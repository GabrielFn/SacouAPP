import { onlineManager, QueryCache, QueryClient } from "@tanstack/react-query";

import type { NetworkStatus } from "../api/network-status";
import { applyCacheEffects, groupGoneEffects } from "./invalidation";
import { PERSISTED_CACHE_MAX_AGE_MS } from "./persist-policy";
import { queryRetryDelay, shouldRetryQuery } from "./retry-policy";

/**
 * The defaults of every query and mutation (D6). `gcTime` is at least the persister's `maxAge`, or a
 * query would leave memory before it is written. Mutations are never repeated and never wait for the
 * network: offline they fail at once, instead of running alone hours later.
 */
export function createSacouQueryClient(): QueryClient {
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        applyCacheEffects(client, groupGoneEffects(query.queryKey, error));
      },
    }),
    defaultOptions: {
      queries: {
        gcTime: PERSISTED_CACHE_MAX_AGE_MS,
        retry: shouldRetryQuery,
        retryDelay: queryRetryDelay,
        refetchOnReconnect: true,
      },
      // The result of a mutation (an invite token) leaves memory as soon as no screen holds it (H6).
      mutations: { retry: false, networkMode: "always", gcTime: 0 },
    },
  });
  return client;
}

/** TanStack hears the network from the `NetworkStatus`, so a query refetches when it comes back. */
export function bindOnlineManager(networkStatus: NetworkStatus): () => void {
  onlineManager.setEventListener((setOnline) => {
    setOnline(networkStatus.isOnline());
    return networkStatus.subscribe(setOnline);
  });
  return () => {
    onlineManager.setEventListener(() => undefined);
  };
}
