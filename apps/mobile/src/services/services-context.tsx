import { createContext, useContext, type ReactNode } from "react";

import type { BatteryMonitor } from "../features/court/ports/battery-monitor";
import type { BackGuard } from "../features/court/ports/back-guard";
import type { Clock } from "../features/court/ports/clock";
import type { CourtFeedback } from "../features/court/ports/court-feedback";
import type { CourtRoster } from "../features/court/ports/court-roster";
import type { CourtRoundSettings } from "../features/court/ports/court-round-settings";
import type { CourtThemePreference } from "../features/court/ports/court-theme-preference";
import type { CourtRuntimeOpener } from "../features/court/ports/court-runtime";
import type { ReducedMotion } from "../features/court/ports/reduced-motion";
import type { ScreenAwake } from "../features/court/ports/screen-awake";
import type { ScreenOrientation } from "../features/court/ports/screen-orientation";
import type { InviteLinkStore } from "../features/groups/ports/invite-link-store";
import type { LegalLinks } from "../config/legal-links";
import type { OnboardingSkip } from "../features/profile/ports/onboarding-skip";
import type { NetworkStatus } from "./api/network-status";
import type { AuthSession } from "./auth/auth-session";
import type { SacouApi } from "./api/sacou-api";
import type { Clipboard } from "./clipboard/clipboard";
import type { FontLoader } from "./font-loader";
import type { IdGenerator } from "./id/id-generator";
import type { ExternalLink } from "./links/external-link";
import type { QrEncoder } from "./qr/qr-encoder";
import type { CoinFlip } from "./random/coin-flip";
import type { FileShare } from "./share/file-share";
import type { ShareSheet } from "./share/share-sheet";

import type { CacheSession } from "./query/cache-persister";
import type { SessionEnder } from "./session/end-session";

export interface Services {
  readonly fontLoader: FontLoader;
  readonly courtRuntimeOpener: CourtRuntimeOpener;
  /** Names and team colors of the court, from the members cache, so they show offline (E4.7, D7). */
  readonly courtRoster: CourtRoster;
  /** "Ponto individual" of the round of a court session, from the rounds cache (E4.10, D10). */
  readonly courtRoundSettings: CourtRoundSettings;
  /** What the phone does for the court: stay awake, buzz, block the back button, keep time. */
  readonly screenAwake: ScreenAwake;
  /** The court turns the phone on its side and puts it back (E4.17). */
  readonly screenOrientation: ScreenOrientation;
  /** The court warns once when the battery is low (E4.17). */
  readonly batteryMonitor: BatteryMonitor;
  readonly courtFeedback: CourtFeedback;
  /** Sun or night, chosen in the menu of the court and kept on the phone (E4.10, D9). */
  readonly courtThemePreference: CourtThemePreference;
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
  /** The export of screen 30a: a temporary file handed to the share sheet, then deleted (E4.3, D9). */
  readonly fileShare: FileShare;
  /** Only "Copiar" of the invite and "Copiar lista" of the round write here (ADR 0049, D7; ADR 0054). */
  readonly clipboard: Clipboard;
  /** Opens WhatsApp with the invite; on a phone without it, the share sheet takes over. */
  readonly externalLink: ExternalLink;
  /** The `requestId` of a guest, made once per opening of the sheet 21a (ADR 0053, D5). */
  readonly idGenerator: IdGenerator;
  /** "Sortear" of who serves first on sheet 08 (E4.7, D10). */
  readonly coinFlip: CoinFlip;
  readonly qrEncoder: QrEncoder;
  /** The only place of an invite token on the phone (ADR 0049, D7). */
  readonly inviteLinkStore: InviteLinkStore;
  /** The origin of the invite links, or `null` until there is a domain: the invite buttons hide. */
  readonly inviteBaseUrl: string | null;
  /** Sign-out clears the server cache, in memory and in `sacou-cache.db` (through `sessionEnder`). */
  readonly cacheSession: CacheSession;
  /** The session of the person on this phone; its state lives only in the SDK (ADR 0057, D2). */
  readonly authSession: AuthSession;
  /** The one way out of a session: Sair, the expired session, a session ended elsewhere (D4). */
  readonly sessionEnder: SessionEnder;
  /** Terms and privacy policy, or `null` each until E6.1 publishes them (question 62). */
  readonly legalLinks: LegalLinks;
  /** "Pular" of screen 27 with nothing to save; forgotten when the session ends (E4.3, D6). */
  readonly onboardingSkip: OnboardingSkip;
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
