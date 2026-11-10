import type { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider, type Persister } from "@tanstack/react-query-persist-client";
import { useEffect, type ReactNode } from "react";

import type { NetworkStatus } from "../api/network-status";
import { persistOptions } from "./cache-persister";
import { bindOnlineManager } from "./query-client";

export interface QueryProviderProps {
  readonly client: QueryClient;
  readonly persister: Persister;
  readonly networkStatus: NetworkStatus;
  readonly appVersion: string;
  readonly children: ReactNode;
}

/** The server cache of the app, restored from `sacou-cache.db` and written back as it changes (D6). */
export function QueryProvider({
  client,
  persister,
  networkStatus,
  appVersion,
  children,
}: QueryProviderProps) {
  useEffect(() => bindOnlineManager(networkStatus), [networkStatus]);
  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={persistOptions(persister, appVersion)}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
