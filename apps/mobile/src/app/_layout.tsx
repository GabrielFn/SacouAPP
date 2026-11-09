import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

import {
  expoBenchmarkRuntimeOpener,
  expoCourtRuntimeOpener,
} from "../adapters/expo-court-runtime-opener";
import { expoHapticsFeedback } from "../adapters/expo-haptics-feedback";
import { expoKeepAwakeScreen } from "../adapters/expo-keep-awake-screen";
import { performanceClock } from "../adapters/performance-clock";
import { reactNativeBackGuard } from "../adapters/react-native-back-guard";
import { createReactNativeReducedMotion } from "../adapters/react-native-reduced-motion";
import { expoFontLoader } from "../adapters/expo-font-loader";
import { createSampleRoster } from "../features/court/dev/sample-roster";
import { DatabaseGate } from "../services/DatabaseGate";
import { ServicesProvider, useServices, type Services } from "../services/services-context";
import { ThemeProvider } from "../theme/theme-context";

const realServices: Services = {
  fontLoader: expoFontLoader,
  courtRuntimeOpener: expoCourtRuntimeOpener,
  // The sample names until the pre-game brings the real roster, which works offline (E4.2, E4.7).
  courtRoster: createSampleRoster(),
  screenAwake: expoKeepAwakeScreen,
  courtFeedback: expoHapticsFeedback,
  backGuard: reactNativeBackGuard,
  reducedMotion: createReactNativeReducedMotion(),
  clock: performanceClock,
  benchmarkRuntimeOpener: expoBenchmarkRuntimeOpener,
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
        <ThemeProvider name="app">
          <FontGate />
        </ThemeProvider>
      </ServicesProvider>
    </SafeAreaProvider>
  );
}
