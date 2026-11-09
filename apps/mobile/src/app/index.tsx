import { CURRENT_EVENT_SCHEMA_VERSION } from "@sacou/match-engine";
import { FORMATION_SYSTEMS } from "@sacou/volley-rules";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { useCourtRuntime } from "../features/court/hooks/court-runtime-context";
import { courtHref } from "../features/court/navigation";
import { findResumableCourtSession } from "../features/court/session/resume-court";
import { DEV_TOOLS_ENABLED } from "../config/dev-tools";
import { strings } from "../strings/pt-BR";
import { AppHeader } from "../ui/AppHeader";
import { Button } from "../ui/Button";
import { Screen } from "../ui/Screen";
import { Text } from "../ui/Text";

// Keeps the workspace packages in the bundle until real features use them.
const WORKSPACE_EXPORTS = [...FORMATION_SYSTEMS, CURRENT_EVENT_SCHEMA_VERSION] as const;

/** A match in progress brings the user back to the court after the app was closed (E4.9). */
export default function HomeScreen() {
  const runtime = useCourtRuntime();
  const router = useRouter();
  const [resumable, setResumable] = useState<string | null>(null);
  useEffect(() => {
    void findResumableCourtSession(runtime).then(setResumable);
  }, [runtime]);
  if (resumable !== null) {
    return <Redirect href={courtHref("court", { courtSessionId: resumable, theme: "sun" })} />;
  }
  return (
    <Screen>
      <AppHeader />
      <View testID={WORKSPACE_EXPORTS.join()}>
        <Text variant="muted">{strings.home.placeholder}</Text>
      </View>
      {DEV_TOOLS_ENABLED ? (
        <Button
          label={strings.court.dev.title}
          variant="secondary"
          onPress={() => {
            router.push("/dev/court");
          }}
        />
      ) : null}
    </Screen>
  );
}
