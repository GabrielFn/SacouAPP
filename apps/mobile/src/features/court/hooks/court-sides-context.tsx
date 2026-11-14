import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export interface CourtSidesControl {
  readonly inverted: boolean;
  readonly toggle: () => void;
}

const CourtSidesContext = createContext<CourtSidesControl | null>(null);

/**
 * "Inverter lados" lives as long as the court layout does: it survives a trip to the menu and is gone
 * when the court closes. It is not part of the match, so it is not in the event log.
 */
export function CourtSidesProvider({ children }: { readonly children: ReactNode }) {
  const [inverted, setInverted] = useState(false);
  const toggle = useCallback(() => {
    setInverted((current) => !current);
  }, []);
  const value = useMemo(() => ({ inverted, toggle }), [inverted, toggle]);
  return <CourtSidesContext.Provider value={value}>{children}</CourtSidesContext.Provider>;
}

export function useCourtSides(): CourtSidesControl {
  const sides = useContext(CourtSidesContext);
  if (!sides) throw new Error("CourtSidesProvider is missing from the tree.");
  return sides;
}
