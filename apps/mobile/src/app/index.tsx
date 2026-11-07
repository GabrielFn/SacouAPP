import { CURRENT_EVENT_SCHEMA_VERSION } from "@sacou/match-engine";
import { FORMATION_SYSTEMS } from "@sacou/volley-rules";
import { View } from "react-native";

import { strings } from "../strings/pt-BR";
import { AppHeader } from "../ui/AppHeader";
import { Screen } from "../ui/Screen";
import { Text } from "../ui/Text";

// Keeps the workspace packages in the bundle until real features use them.
const WORKSPACE_EXPORTS = [...FORMATION_SYSTEMS, CURRENT_EVENT_SCHEMA_VERSION] as const;

export default function HomeScreen() {
  return (
    <Screen>
      <AppHeader />
      <View testID={WORKSPACE_EXPORTS.join()}>
        <Text variant="muted">{strings.home.placeholder}</Text>
      </View>
    </Screen>
  );
}
