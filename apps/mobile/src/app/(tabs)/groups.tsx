import { useRouter, type Href } from "expo-router";
import { View } from "react-native";

import { useGroupsScreen } from "../../features/groups/hooks/use-groups-screen";
import {
  groupsSummaryText,
  type GroupCardAction,
} from "../../features/groups/model/groups-list.selectors";
import {
  createGroupHref,
  groupMembersHref,
  groupSettingsHref,
} from "../../features/groups/navigation";
import { CreateGroupPill } from "../../features/groups/ui/CreateGroupPill";
import { GroupCardList } from "../../features/groups/ui/GroupCardList";
import { GroupsStateView } from "../../features/groups/ui/GroupsStateView";
import { createRoundHref, editRoundHref, groupRoundsHref } from "../../features/rounds/navigation";
import { strings } from "../../strings/pt-BR";
import { useTheme } from "../../theme/theme-context";
import { OfflineBanner } from "../../ui/OfflineBanner";
import { Screen } from "../../ui/Screen";
import { Text } from "../../ui/Text";

function actionHref(action: Exclude<GroupCardAction, "editRound">, groupId: string): Href {
  switch (action) {
    case "members":
      return groupMembersHref(groupId);
    case "settings":
      return groupSettingsHref(groupId);
    case "createRound":
      return createRoundHref(groupId);
  }
}

/** The groups list (screen 17), ordered by the next round; groups without one keep the API order. */
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
          <GroupCardList
            groups={groups}
            onAction={(action, groupId) => {
              router.push(actionHref(action, groupId));
            }}
            onEditRound={(groupId, roundId) => {
              router.push(editRoundHref(groupId, roundId));
            }}
            onOpenGroup={(groupId) => {
              router.push(groupRoundsHref(groupId));
            }}
          />
        )}
      />
    </Screen>
  );
}
