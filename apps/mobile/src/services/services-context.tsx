import { createContext, useContext, type ReactNode } from "react";

import type { BatteryMonitor } from "../features/court/ports/battery-monitor";
import type { BackGuard } from "../features/court/ports/back-guard";
import type { AppForeground } from "../features/court/ports/app-foreground";
import type { Scheduler } from "./scheduler/scheduler";
import type { KeyboardVisibility } from "../ui/keyboard-visibility";
import type { Clock } from "../features/court/ports/clock";
import type { CourtFeedback } from "../features/court/ports/court-feedback";
import type { CourtRoster } from "../features/court/ports/court-roster";
import type { CourtRoundSettings } from "../features/court/ports/court-round-settings";
import type { CourtThemePreference } from "../features/court/ports/court-theme-preference";
import type { CourtRoundSource } from "../features/court/ports/court-round-source";
import type { RoundEndLookup } from "../features/court/ports/round-end-lookup";
import type { NextMatchDraftStore } from "../features/court/ports/next-match-draft-store";
import type { CourtRuntimeOpener } from "../features/court/ports/court-runtime";
import type { ReducedMotion } from "../features/court/ports/reduced-motion";
import type { ScreenAwake } from "../features/court/ports/screen-awake";
import type { ScreenOrientation } from "../features/court/ports/screen-orientation";
import type { InviteLinkStore } from "../features/groups/ports/invite-link-store";
import type { LegalLinks } from "../config/legal-links";
import type {
  CardImageCapture,
  GallerySaver,
  ImageShare,
} from "../features/profile/ports/card-image";
import type { OnboardingSkip } from "../features/profile/ports/onboarding-skip";
import type { NotificationPermission } from "../features/notifications/ports/notification-permission";
import type { NotificationTaps } from "../features/notifications/ports/notification-taps";
import type { PushRegistration } from "../features/notifications/registration/push-registration";
import type { PushOutcomeLog } from "../features/notifications/ports/push-outcome-log";
import type { PushPromptMemory } from "../features/notifications/ports/push-prompt-memory";
import type { NetworkStatus } from "./api/network-status";
import type { AuthSession } from "./auth/auth-session";
import type { SacouApi } from "./api/sacou-api";
import type { Clipboard } from "./clipboard/clipboard";
import type { FontLoader } from "./font-loader";
import type { IdGenerator } from "./id/id-generator";
import type { ExternalLink } from "./links/external-link";
import type { QrEncoder } from "./qr/qr-encoder";
import type { CoinFlip } from "./random/coin-flip";
import type { Shuffler } from "./random/shuffler";
import type { RandomSource } from "./random/random-source";
import type { FileShare } from "./share/file-share";
import type { ShareSheet } from "./share/share-sheet";

import type { CacheSession } from "./query/cache-persister";
import type { SessionEnder } from "./session/end-session";
import type { ErrorReporter } from "./error-reporting/error-reporter";

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
  /** The soft keyboard, so a sheet backdrop closes it first (R98 part 3). */
  readonly keyboard: KeyboardVisibility;
  /** Opens a second database for the Hermes benchmark, never the one of the matches. */
  readonly benchmarkRuntimeOpener: CourtRuntimeOpener;
  /** The API, typed by the contract (E4.2). Its answers live only in the TanStack cache, never here. */
  readonly sacouApi: SacouApi;
  readonly networkStatus: NetworkStatus;
  /** The court upload tries again when the app comes back to the front (E4.11). */
  readonly appForeground: AppForeground;
  /** The waits of the court upload (E4.11). */
  readonly scheduler: Scheduler;
  /** The variation of the backoff of the court upload: never a secret. */
  readonly randomSource: RandomSource;
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
  /** The draw of who leaves the court, once per finished match (E4.10, D7). */
  readonly shuffler: Shuffler;
  /** The draft of the next match on screen 11, kept until it starts (E4.10, D7; only ids). */
  readonly nextMatchDrafts: NextMatchDraftStore;
  /** The round of a court session from the persisted cache, never the network (E4.10, D7). */
  readonly courtRounds: CourtRoundSource;
  /** The end of the round of a court session, from the persisted cache (R97, D4 and D5). */
  readonly roundEnds: RoundEndLookup;
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
  /** Screen 15: the card turned into a temporary PNG (E4.13, part 2). */
  readonly cardCapture: CardImageCapture;
  /** Screen 15, "WhatsApp": the PNG in the system share sheet. */
  readonly imageShare: ImageShare;
  /** Screen 15, "Salvar": the PNG in the gallery, write-only. */
  readonly gallerySaver: GallerySaver;
  /** The system permission of the notifications, read on screen 28 (E3.11). */
  readonly notificationPermission: NotificationPermission;
  /** The touches on the pushes and the pushes that arrive with the app in front (E3.11). */
  readonly notificationTaps: NotificationTaps;
  /** The push device of this install, registered only while signed in (E3.11). */
  readonly pushDevices: PushRegistration;
  /** The outcome of each registration, in the Metro log in development only (R98, item 9). */
  readonly pushOutcomeLog: PushOutcomeLog;
  /** Whether the notifications were already offered on this phone (R98, item 9). */
  readonly pushPromptMemory: PushPromptMemory;
  /** The errors the app did not expect, cleaned of personal data, to Sentry (E5.2, ADR 0080). */
  readonly errorReporter: ErrorReporter;
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
