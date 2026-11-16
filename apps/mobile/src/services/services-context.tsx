import { createContext, useContext, type ReactNode } from "react";

import type { BatteryMonitor } from "../features/court/ports/battery-monitor";
import type { BackGuard } from "../features/court/ports/back-guard";
import type { Clock } from "../features/court/ports/clock";
import type { CourtFeedback } from "../features/court/ports/court-feedback";
import type { CourtRoster } from "../features/court/ports/court-roster";
import type { CourtRuntimeOpener } from "../features/court/ports/court-runtime";
import type { ReducedMotion } from "../features/court/ports/reduced-motion";
import type { ScreenAwake } from "../features/court/ports/screen-awake";
import type { ScreenOrientation } from "../features/court/ports/screen-orientation";
import type { InviteLinkStore } from "../features/groups/ports/invite-link-store";
import type { NetworkStatus } from "./api/network-status";
import type { SacouApi } from "./api/sacou-api";
import type { Clipboard } from "./clipboard/clipboard";
import type { FontLoader } from "./font-loader";
import type { ExternalLink } from "./links/external-link";
import type { QrEncoder } from "./qr/qr-encoder";
import type { ShareSheet } from "./share/share-sheet";

import type { CacheSession } from "./query/cache-persister";

export interface Services {
  readonly fontLoader: FontLoader;
  readonly courtRuntimeOpener: CourtRuntimeOpener;
  /** Names and team colors of the court; the sample one until the pre-game exists (E4.7). */
  readonly courtRoster: CourtRoster;
  /** What the phone does for the court: stay awake, buzz, block the back button, keep time. */
  readonly screenAwake: ScreenAwake;
  /** The court turns the phone on its side and puts it back (E4.17). */
  readonly screenOrientation: ScreenOrientation;
  /** The court warns once when the battery is low (E4.17). */
  readonly batteryMonitor: BatteryMonitor;
  readonly courtFeedback: CourtFeedback;
  readonly backGuard: BackGuard;
  readonly reducedMotion: ReducedMotion;
  readonly clock: Clock;
  /** Opens a second database for the Hermes benchmark, never the one of the matches. */
  readonly benchmarkRuntimeOpener: CourtRuntimeOpener;
  /** The API, typed by the contract (E4.2). Its answers live only in the TanStack cache, never here. */
  readonly sacouApi: SacouApi;
  readonly networkStatus: NetworkStatus;
  /** The system share sheet, for the round message (E4.6). */
  readonly shareSheet: ShareSheet;
  /** Only "Copiar" of the invite writes here (ADR 0049, D7). */
  readonly clipboard: Clipboard;
  /** Opens WhatsApp with the invite; on a phone without it, the share sheet takes over. */
  readonly externalLink: ExternalLink;
  readonly qrEncoder: QrEncoder;
  /** The only place of an invite token on the phone (ADR 0049, D7). */
  readonly inviteLinkStore: InviteLinkStore;
  /** The origin of the invite links, or `null` until there is a domain: the invite buttons hide. */
  readonly inviteBaseUrl: string | null;
  /** Sign-out clears the server cache, in memory and in `sacou-cache.db` (E4.3 calls it). */
  readonly cacheSession: CacheSession;
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
