import { createContext, useContext, type ReactNode } from "react";

import type { CourtSync } from "../ports/court-sync";

const CourtSyncContext = createContext<CourtSync | null>(null);

export interface CourtSyncProviderProps {
  readonly sync: CourtSync;
  readonly children: ReactNode;
}

/** The one upload loop of the app (ADR 0067), opened with the local database. */
export function CourtSyncProvider({ sync, children }: CourtSyncProviderProps) {
  return <CourtSyncContext.Provider value={sync}>{children}</CourtSyncContext.Provider>;
}

export function useCourtSync(): CourtSync {
  const sync = useContext(CourtSyncContext);
  if (!sync) throw new Error("CourtSyncProvider is missing from the tree.");
  return sync;
}
