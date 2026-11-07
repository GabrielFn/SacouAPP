import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { expoFontLoader } from "../adapters/expo-font-loader";
import { ServicesProvider, useServices, type Services } from "../services/services-context";
import { ThemeProvider } from "../theme/theme-context";

const realServices: Services = { fontLoader: expoFontLoader };

function FontGate() {
  const { fontLoader } = useServices();
  const loaded = fontLoader.useFontsLoaded();
  return loaded ? <Stack screenOptions={{ headerShown: false }} /> : null;
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
