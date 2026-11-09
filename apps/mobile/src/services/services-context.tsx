import { createContext, useContext, type ReactNode } from "react";

import type { CourtRoster } from "../features/court/ports/court-roster";
import type { CourtRuntimeOpener } from "../features/court/ports/court-runtime";
import type { FontLoader } from "./font-loader";

export interface Services {
  readonly fontLoader: FontLoader;
  readonly courtRuntimeOpener: CourtRuntimeOpener;
  /** Names and team colors of the court; the sample one until the pre-game exists (E4.7). */
  readonly courtRoster: CourtRoster;
}

const ServicesContext = createContext<Services | null>(null);

export interface ServicesProviderProps {
  readonly services: Services;
  readonly children: ReactNode;
}

export function ServicesProvider({ services, children }: ServicesProviderProps) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services) throw new Error("ServicesProvider is missing from the tree.");
  return services;
}
