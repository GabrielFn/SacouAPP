import { useRouter } from "expo-router";

import { accountRoutes } from "../../features/account/navigation";
import { AccountCard, AccountRow } from "../../features/account/ui/AccountRow";
import { strings } from "../../strings/pt-BR";
import { GearIcon } from "../../ui/MenuIcons";
import { Screen } from "../../ui/Screen";
import { Text } from "../../ui/Text";

/**
 * Placeholder of the "Eu" tab: the profile (screen 14) arrives with E4.8, which moves the way to the
 * account (screen 30, where "Sair" is) to the gear of its header.
 */
export default function MeScreen() {
  const router = useRouter();
  return (
    <Screen aboveTabBar>
      <Text variant="display" displaySize="displayTitle">
        {strings.groups.meTitle}
      </Text>
      <AccountCard title={strings.account.more}>
        <AccountRow
          icon={<GearIcon />}
          label={strings.account.entry}
          onPress={() => {
            router.push(accountRoutes.account);
          }}
          last
        />
      </AccountCard>
    </Screen>
  );
}
