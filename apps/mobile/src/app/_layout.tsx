import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

import {
  expoBenchmarkRuntimeOpener,
  expoCourtRuntimeOpener,
} from "../adapters/expo-court-runtime-opener";
import { expoHapticsFeedback } from "../adapters/expo-haptics-feedback";
import { expoKeepAwakeScreen } from "../adapters/expo-keep-awake-screen";
import { expoBatteryMonitor } from "../adapters/expo-battery-monitor";
import { expoScreenOrientation } from "../adapters/expo-screen-orientation";
import { performanceClock } from "../adapters/performance-clock";
import { reactNativeBackGuard } from "../adapters/react-native-back-guard";
import { createReactNativeReducedMotion } from "../adapters/react-native-reduced-motion";
import { reactNativeShareSheet } from "../adapters/react-native-share-sheet";
import { expoClipboard } from "../adapters/expo-clipboard";
import { qrcodeGeneratorEncoder } from "../adapters/qrcode-generator-encoder";
import { reactNativeExternalLink } from "../adapters/react-native-external-link";
import { secureStoreInviteLinkStore } from "../adapters/secure-store-invite-link-store";
import { buildInviteBaseUrl } from "../config/invite-url";
import { expoFontLoader } from "../adapters/expo-font-loader";
import { bindAppStateFocus } from "../adapters/app-state-focus";
import { expoAppVersion } from "../adapters/expo-app-version";
import { createExpoCacheStore } from "../adapters/expo-cache-store";
import { createFirebaseAuthSdk } from "../adapters/firebase-auth-sdk";
import { createFirebaseAuthSession } from "../adapters/firebase-auth-session";
import { createGoogleAccountPicker } from "../adapters/google-sign-in";
import { fetchHttpTransport } from "../adapters/fetch-http-transport";
import { createHttpSacouApi } from "../adapters/http-sacou-api";
import { createNetInfoNetworkStatus } from "../adapters/netinfo-network-status";
import { createStoredOnboardingSkip } from "../adapters/stored-onboarding-skip";
import { buildApiBaseUrl } from "../config/api-url";
import { buildGoogleWebClientId } from "../config/google-sign-in";
import { buildLegalLinks } from "../config/legal-links";
import {
  ONBOARDING_ROUTES,
  SIGNED_IN_ROUTES,
  SIGNED_OUT_ROUTES,
} from "../features/auth/navigation";
import { useOnboardingGate } from "../features/profile/hooks/use-profile";
import { useSession } from "../services/auth/use-session";
import { createSessionEnder, sessionIdTokens } from "../services/session/end-session";
import { useSessionCleanup } from "../services/session/use-session-cleanup";
import { createSampleRoster } from "../features/court/dev/sample-roster";
import { DatabaseGate } from "../services/DatabaseGate";
import { createCachePersister, createCacheSession } from "../services/query/cache-persister";
import { createSacouQueryClient } from "../services/query/query-client";
import { QueryProvider } from "../services/query/query-provider";
import { ServicesProvider, useServices, type Services } from "../services/services-context";
import { ThemeProvider } from "../theme/theme-context";

const queryClient = createSacouQueryClient();
const cacheStore = createExpoCacheStore();
const cachePersister = createCachePersister(cacheStore);
// A row of its own in sacou-cache.db, apart from the persisted cache: a flag, never the profile.
const onboardingSkip = createStoredOnboardingSkip(cacheStore);
const networkStatus = createNetInfoNetworkStatus();
const googleWebClientId = buildGoogleWebClientId();
// The session lives in the native Firebase SDK; the app only reads it (ADR 0057, D2 and D5).
const authSession = createFirebaseAuthSession({
  sdk: createFirebaseAuthSdk(),
  google: googleWebClientId === null ? null : createGoogleAccountPicker(googleWebClientId),
});
const cacheSession = createCacheSession(queryClient, cachePersister);
const sessionEnder = createSessionEnder({
  authSession,
  queries: queryClient,
  stores: { cacheSession, inviteLinkStore: secureStoreInviteLinkStore, onboardingSkip },
});
bindAppStateFocus();

const realServices: Services = {
  fontLoader: expoFontLoader,
  courtRuntimeOpener: expoCourtRuntimeOpener,
  // The sample names until the pre-game brings the real roster, which works offline (E4.2, E4.7).
  courtRoster: createSampleRoster(),
  screenAwake: expoKeepAwakeScreen,
  screenOrientation: expoScreenOrientation,
  batteryMonitor: expoBatteryMonitor,
  courtFeedback: expoHapticsFeedback,
  backGuard: reactNativeBackGuard,
  reducedMotion: createReactNativeReducedMotion(),
  clock: performanceClock,
  benchmarkRuntimeOpener: expoBenchmarkRuntimeOpener,
  sacouApi: createHttpSacouApi({
    baseUrl: buildApiBaseUrl(__DEV__),
    transport: fetchHttpTransport,
    idTokens: sessionIdTokens(authSession, sessionEnder),
  }),
  networkStatus,
  shareSheet: reactNativeShareSheet,
  clipboard: expoClipboard,
  externalLink: reactNativeExternalLink,
  qrEncoder: qrcodeGeneratorEncoder,
  inviteLinkStore: secureStoreInviteLinkStore,
  inviteBaseUrl: buildInviteBaseUrl(__DEV__),
  cacheSession,
  authSession,
  sessionEnder,
  legalLinks: buildLegalLinks(),
  onboardingSkip,
};

/**
 * The gate of ADR 0057 (D3): nothing while the SDK reads the session (the splash stays, the login does
 * not blink), the login alone when signed out, and every other route when signed in. While the profile
 * is missing and was not skipped, screen 27 alone (D6); loading or offline, the app (nobody held there).
 */
function SessionStack() {
  const session = useSession();
  useSessionCleanup(session);
  const signedIn = session.status === "signedIn";
  const onboarding = useOnboardingGate(signedIn) === "show";
  if (session.status === "unknown") return null;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={signedIn && !onboarding}>
        {SIGNED_IN_ROUTES.map((name) => (
          <Stack.Screen key={name} name={name} />
        ))}
      </Stack.Protected>
      <Stack.Protected guard={onboarding}>
        {ONBOARDING_ROUTES.map((name) => (
          <Stack.Screen key={name} name={name} />
        ))}
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        {SIGNED_OUT_ROUTES.map((name) => (
          <Stack.Screen key={name} name={name} />
        ))}
      </Stack.Protected>
    </Stack>
  );
}

function FontGate() {
  const { fontLoader } = useServices();
  const loaded = fontLoader.useFontsLoaded();
  return loaded ? (
    <DatabaseGate>
      <SessionStack />
    </DatabaseGate>
  ) : null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ServicesProvider services={realServices}>
        <QueryProvider
          client={queryClient}
          persister={cachePersister}
          networkStatus={networkStatus}
          appVersion={expoAppVersion()}
        >
          <ThemeProvider name="app">
            <FontGate />
          </ThemeProvider>
        </QueryProvider>
      </ServicesProvider>
    </SafeAreaProvider>
  );
}
