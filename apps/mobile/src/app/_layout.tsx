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
import { expoFontLoader } from "../adapters/expo-font-loader";
import { bindAppStateFocus } from "../adapters/app-state-focus";
import { expoAppVersion } from "../adapters/expo-app-version";
import { createExpoCacheStore } from "../adapters/expo-cache-store";
import { createFakeIdTokenProvider, FAKE_ID_TOKEN } from "../adapters/fake-id-token-provider";
import { fetchHttpTransport } from "../adapters/fetch-http-transport";
import { createHttpSacouApi } from "../adapters/http-sacou-api";
import { createNetInfoNetworkStatus } from "../adapters/netinfo-network-status";
import { buildApiBaseUrl } from "../config/api-url";
import { createSampleRoster } from "../features/court/dev/sample-roster";
import { DatabaseGate } from "../services/DatabaseGate";
import { createCachePersister, createCacheSession } from "../services/query/cache-persister";
import { createSacouQueryClient } from "../services/query/query-client";
import { QueryProvider } from "../services/query/query-provider";
import { ServicesProvider, useServices, type Services } from "../services/services-context";
import { ThemeProvider } from "../theme/theme-context";

const queryClient = createSacouQueryClient();
const cachePersister = createCachePersister(createExpoCacheStore());
const networkStatus = createNetInfoNetworkStatus();
// Until the login (E4.3) brings Firebase, only a development build has a token, and a release build
// never calls the API.
const idTokenProvider = createFakeIdTokenProvider(__DEV__ ? FAKE_ID_TOKEN : null);
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
    idTokens: idTokenProvider,
  }),
  networkStatus,
  shareSheet: reactNativeShareSheet,
  cacheSession: createCacheSession(queryClient, cachePersister),
};

function FontGate() {
  const { fontLoader } = useServices();
  const loaded = fontLoader.useFontsLoaded();
  return loaded ? (
    <DatabaseGate>
      <Stack screenOptions={{ headerShown: false }} />
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
