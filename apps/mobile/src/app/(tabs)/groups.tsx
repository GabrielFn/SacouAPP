import { useRouter } from "expo-router";
import { View } from "react-native";

import { useGroupsScreen } from "../../features/groups/hooks/use-groups-screen";
import {
  groupCardActions,
  groupCardModel,
  groupsSummaryText,
} from "../../features/groups/model/groups-list.selectors";
import {
  createGroupHref,
  groupMembersHref,
  groupSettingsHref,
  PENDING_GROUP_SCREENS,
} from "../../features/groups/navigation";
import { CreateGroupPill } from "../../features/groups/ui/CreateGroupPill";
import { GroupCard } from "../../features/groups/ui/GroupCard";
import { GroupsStateView } from "../../features/groups/ui/GroupsStateView";
import { strings } from "../../strings/pt-BR";
import { useTheme } from "../../theme/theme-context";
import { OfflineBanner } from "../../ui/OfflineBanner";
import { Screen } from "../../ui/Screen";
import { Text } from "../../ui/Text";

/** The groups list (screen 17). Order is the one of the API: the order of joining. */
export default function GroupsScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const { state, bannerText, retry } = useGroupsScreen();
  const goToCreateGroup = () => {
    router.push(createGroupHref);
  };
  const summary = state.kind === "list" ? groupsSummaryText(state.groups) : null;
  return (
    <Screen aboveTabBar scroll>
      <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s10 }}>
        <Text variant="display" displaySize="displayTitle" style={{ flex: 1 }}>
          {strings.groups.title}
        </Text>
        <CreateGroupPill onPress={goToCreateGroup} />
      </View>
      {summary !== null ? <Text variant="muted">{summary}</Text> : null}
      {bannerText !== null ? <OfflineBanner text={bannerText} /> : null}
      <GroupsStateView
        state={state}
        onRetry={retry}
        onCreateGroup={goToCreateGroup}
        renderList={(groups) => (
          <View style={{ gap: tokens.spacing.s10 }}>
            {groups.map((group) => (
              <GroupCard
                key={group.groupId}
                model={groupCardModel(group)}
                actions={groupCardActions(group.role, PENDING_GROUP_SCREENS)}
                onAction={(action, groupId) => {
                  router.push(
                    action === "members" ? groupMembersHref(groupId) : groupSettingsHref(groupId),
                  );
                }}
              />
            ))}
          </View>
        )}
      />
    </Screen>
  );
}
