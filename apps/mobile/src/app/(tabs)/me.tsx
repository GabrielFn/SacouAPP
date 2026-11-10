import { strings } from "../../strings/pt-BR";
import { Screen } from "../../ui/Screen";
import { Text } from "../../ui/Text";

/** Placeholder of the "Eu" tab: the profile (screen 14) arrives with E4.8. */
export default function MeScreen() {
  return (
    <Screen aboveTabBar>
      <Text variant="display" displaySize="displayTitle">
        {strings.groups.meTitle}
      </Text>
    </Screen>
  );
}
