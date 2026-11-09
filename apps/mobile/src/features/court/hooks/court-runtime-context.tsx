import { createContext, useContext, type ReactNode } from "react";

import type { CourtRuntime } from "../ports/court-runtime";

const CourtRuntimeContext = createContext<CourtRuntime | null>(null);

export interface CourtRuntimeProviderProps {
  readonly runtime: CourtRuntime;
  readonly children: ReactNode;
}

export function CourtRuntimeProvider({ runtime, children }: CourtRuntimeProviderProps) {
  return <CourtRuntimeContext.Provider value={runtime}>{children}</CourtRuntimeContext.Provider>;
}

export function useCourtRuntime(): CourtRuntime {
  const runtime = useContext(CourtRuntimeContext);
  if (!runtime) throw new Error("CourtRuntimeProvider is missing from the tree.");
  return runtime;
}
