import { Stack, useGlobalSearchParams } from "expo-router";

import { useCourtFeedback } from "../../../features/court/hooks/use-court-feedback";
import { useKeepAwakeWhileMounted } from "../../../features/court/hooks/use-keep-awake-while-mounted";
import { useLandscapeWhileMounted } from "../../../features/court/hooks/use-landscape-while-mounted";
import { CourtSessionProvider } from "../../../features/court/hooks/use-court-session";
import { parseCourtTheme, themeNameOf } from "../../../features/court/navigation";
import { ThemeProvider } from "../../../theme/theme-context";

/** What the court does for as long as it is open: keeps the screen on, on its side, and buzzes. */
function CourtDeviceEffects() {
  useKeepAwakeWhileMounted();
  useLandscapeWhileMounted();
  useCourtFeedback();
  return null;
}

/**
 * The court has its own theme and no swipe back: a gesture on the court is never navigation. One
 * controller serves all its routes.
 */
export default function CourtLayout() {
  const params = useGlobalSearchParams<{ courtSessionId: string; theme?: string }>();
  return (
    <ThemeProvider name={themeNameOf(parseCourtTheme(params.theme))}>
      <CourtSessionProvider key={params.courtSessionId} courtSessionId={params.courtSessionId}>
        <CourtDeviceEffects />
        <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} />
      </CourtSessionProvider>
    </ThemeProvider>
  );
}
