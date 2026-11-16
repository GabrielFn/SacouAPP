import { useServices } from "../../services/services-context";
import { strings } from "../../strings/pt-BR";
import { Button } from "../../ui/Button";
import { Screen } from "../../ui/Screen";
import { Text } from "../../ui/Text";

/**
 * Placeholder of the "Eu" tab: the profile (screen 14) arrives with E4.8 and the account (screen 30)
 * with E4.3 part 2, which moves "Sair" there.
 */
export default function MeScreen() {
  const { sessionEnder } = useServices();
  return (
    <Screen aboveTabBar>
      <Text variant="display" displaySize="displayTitle">
        {strings.groups.meTitle}
      </Text>
      <Button
        variant="outline"
        label={strings.auth.signOut}
        onPress={() => {
          void sessionEnder.end("signedOut");
        }}
      />
    </Screen>
  );
}
