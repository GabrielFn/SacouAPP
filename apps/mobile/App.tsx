import { PACKAGE_NAME as MATCH_ENGINE_PACKAGE } from "@sacou/match-engine";
import { PACKAGE_NAME as VOLLEY_RULES_PACKAGE } from "@sacou/volley-rules";
import { StyleSheet, Text, View } from "react-native";

import { strings } from "./src/strings/pt-BR";

const WORKSPACE_PACKAGES = [VOLLEY_RULES_PACKAGE, MATCH_ENGINE_PACKAGE] as const;

export default function App() {
  return (
    <View style={styles.container} testID={WORKSPACE_PACKAGES.join()}>
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
