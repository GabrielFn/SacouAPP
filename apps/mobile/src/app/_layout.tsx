import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { expoCourtRuntimeOpener } from "../adapters/expo-court-runtime-opener";
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
