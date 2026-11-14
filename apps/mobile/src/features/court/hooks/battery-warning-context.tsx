import { createContext, useContext, type ReactNode } from "react";

import { useBatteryWarning, type BatteryWarning } from "./use-battery-warning";

const BatteryWarningContext = createContext<BatteryWarning | null>(null);

/** The state sits in the court layout so the warning does not come back after a trip to the menu. */
export interface BatteryWarningProviderProps {
  readonly children: ReactNode;
}

export function BatteryWarningProvider({ children }: BatteryWarningProviderProps) {
  const warning = useBatteryWarning();
  return (
    <BatteryWarningContext.Provider value={warning}>{children}</BatteryWarningContext.Provider>
  );
}

export function useCourtBatteryWarning(): BatteryWarning {
  const warning = useContext(BatteryWarningContext);
  if (!warning) throw new Error("BatteryWarningProvider is missing from the tree.");
  return warning;
}
