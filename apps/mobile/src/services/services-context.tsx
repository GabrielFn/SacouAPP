import { createContext, useContext, type ReactNode } from "react";

import type { BackGuard } from "../features/court/ports/back-guard";
import type { Clock } from "../features/court/ports/clock";
import type { CourtFeedback } from "../features/court/ports/court-feedback";
import type { CourtRoster } from "../features/court/ports/court-roster";
import type { CourtRuntimeOpener } from "../features/court/ports/court-runtime";
import type { ReducedMotion } from "../features/court/ports/reduced-motion";
import type { ScreenAwake } from "../features/court/ports/screen-awake";
import type { FontLoader } from "./font-loader";

export interface Services {
  readonly fontLoader: FontLoader;
  readonly courtRuntimeOpener: CourtRuntimeOpener;
  /** Names and team colors of the court; the sample one until the pre-game exists (E4.7). */
  readonly courtRoster: CourtRoster;
  /** What the phone does for the court: stay awake, buzz, block the back button, keep time. */
  readonly screenAwake: ScreenAwake;
  readonly courtFeedback: CourtFeedback;
  readonly backGuard: BackGuard;
  readonly reducedMotion: ReducedMotion;
  readonly clock: Clock;
  /** Opens a second database for the Hermes benchmark, never the one of the matches. */
  readonly benchmarkRuntimeOpener: CourtRuntimeOpener;
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
