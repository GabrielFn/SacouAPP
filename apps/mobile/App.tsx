import { CURRENT_EVENT_SCHEMA_VERSION } from "@sacou/match-engine";
import { FORMATION_SYSTEMS } from "@sacou/volley-rules";
import { StyleSheet, Text, View } from "react-native";

import { strings } from "./src/strings/pt-BR";

const WORKSPACE_EXPORTS = [...FORMATION_SYSTEMS, CURRENT_EVENT_SCHEMA_VERSION] as const;

export default function App() {
  return (
    <View style={styles.container} testID={WORKSPACE_EXPORTS.join()}>
      <Text>{strings.appName}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
