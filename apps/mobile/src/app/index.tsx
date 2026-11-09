import { CURRENT_EVENT_SCHEMA_VERSION } from "@sacou/match-engine";
import { FORMATION_SYSTEMS } from "@sacou/volley-rules";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

import { useResumeOnce } from "../features/court/hooks/resume-context";
import { courtHref } from "../features/court/navigation";
import { takeResumeTarget } from "../features/court/session/resume-target";
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
  const router = useRouter();
  const resume = useResumeOnce();
  // The court is resumed once per opening of the app: leaving it for the home must not bring it back.
  useEffect(() => {
    const target = takeResumeTarget(resume);
    if (target !== null) {
      router.replace(courtHref("court", target));
    }
  }, [resume, router]);
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
