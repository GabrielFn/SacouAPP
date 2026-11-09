import { Stack, useGlobalSearchParams } from "expo-router";

import { CourtSessionProvider } from "../../../features/court/hooks/use-court-session";
import { parseCourtTheme, themeNameOf } from "../../../features/court/navigation";
import { ThemeProvider } from "../../../theme/theme-context";

/**
 * The court has its own theme and no swipe back: a gesture on the court is never navigation. One
 * controller serves all its routes.
 */
export default function CourtLayout() {
  const params = useGlobalSearchParams<{ courtSessionId: string; theme?: string }>();
  return (
    <ThemeProvider name={themeNameOf(parseCourtTheme(params.theme))}>
      <CourtSessionProvider key={params.courtSessionId} courtSessionId={params.courtSessionId}>
        <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} />
      </CourtSessionProvider>
    </ThemeProvider>
  );
}
