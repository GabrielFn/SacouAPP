import { View } from "react-native";

import { useGroupsScreen } from "../../features/groups/hooks/use-groups-screen";
import {
  groupCardActions,
  groupCardModel,
  groupsSummaryText,
} from "../../features/groups/model/groups-list.selectors";
import { PENDING_GROUP_SCREENS } from "../../features/groups/navigation";
import { GroupCard } from "../../features/groups/ui/GroupCard";
import { GroupsStateView } from "../../features/groups/ui/GroupsStateView";
import { strings } from "../../strings/pt-BR";
import { useTheme } from "../../theme/theme-context";
import { OfflineBanner } from "../../ui/OfflineBanner";
import { Screen } from "../../ui/Screen";
import { Text } from "../../ui/Text";

/** The groups list (screen 17). Order is the one of the API: the order of joining. */
export default function GroupsScreen() {
  const { tokens } = useTheme();
  const { state, bannerText, retry } = useGroupsScreen();
  const summary = state.kind === "list" ? groupsSummaryText(state.groups) : null;
  return (
    <Screen aboveTabBar scroll>
      <Text variant="display" displaySize="displayTitle">
        {strings.groups.title}
      </Text>
      {summary !== null ? <Text variant="muted">{summary}</Text> : null}
      {bannerText !== null ? <OfflineBanner text={bannerText} /> : null}
      <GroupsStateView
        state={state}
        onRetry={retry}
        renderList={(groups) => (
          <View style={{ gap: tokens.spacing.s10 }}>
            {groups.map((group) => (
              <GroupCard
                key={group.groupId}
                model={groupCardModel(group)}
                actions={groupCardActions(group.role, PENDING_GROUP_SCREENS)}
                onAction={() => undefined}
              />
            ))}
          </View>
        )}
      />
    </Screen>
  );
}
