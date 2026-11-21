import { useRouter } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

import { DEV_TOOLS_ENABLED } from "../../config/dev-tools";
import { useResumeOnce } from "../../features/court/hooks/resume-context";
import { useActiveCourt } from "../../features/court/hooks/use-active-court";
import { ActiveCourtBar } from "../../features/court/ui/ActiveCourtBar";
import { courtHref } from "../../features/court/navigation";
import { takeResumeTarget } from "../../features/court/session/resume-target";
import { useGroupsScreen } from "../../features/groups/hooks/use-groups-screen";
import { groupNameOf } from "../../features/groups/model/groups-view-state";
import { greetingText } from "../../features/groups/model/greeting";
import { useGreetingNickname } from "../../features/profile/hooks/use-profile";
import { createGroupHref, groupsHref, notificationsHref } from "../../features/groups/navigation";
import { GroupsStateView } from "../../features/groups/ui/GroupsStateView";
import { roundHref, summaryHref } from "../../features/rounds/navigation";
import { HomeRoundCards } from "../../features/rounds/ui/HomeRoundCards";
import { useHasUnreadNotifications } from "../../features/notifications/hooks/use-push-session";
import { BellButton } from "../../features/notifications/ui/BellButton";
import { strings } from "../../strings/pt-BR";
import { useTheme } from "../../theme/theme-context";
import { AppHeader } from "../../ui/AppHeader";
import { PlusIcon } from "../../ui/Icons";
import { Button } from "../../ui/Button";
import { IconButton } from "../../ui/IconButton";
import { OfflineBanner } from "../../ui/OfflineBanner";
import { Screen } from "../../ui/Screen";
import { Text } from "../../ui/Text";

const { home } = strings.groups;

/**
 * The home (screen 03). A match in progress brings the user back to the court after a restart (E4.9),
 * until its round ends (R97, D4); the bar "EM QUADRA" leads to it at any time (R97, D1).
 */
export default function HomeScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const resume = useResumeOnce();
  const { state, bannerText, retry } = useGroupsScreen();
  const nickname = useGreetingNickname();
  const unread = useHasUnreadNotifications();
  const active = useActiveCourt();
  // The court is resumed once per opening of the app: leaving it for the home must not bring it back.
  useEffect(() => {
    const target = takeResumeTarget(resume);
    if (target !== null) {
      router.replace(courtHref("court", target));
    }
  }, [resume, router]);
  const goToCreateGroup = () => {
    router.push(createGroupHref);
  };
  const seeGroups = [
    {
      label: home.seeGroups,
      variant: "secondary" as const,
      onPress: () => {
        router.navigate(groupsHref);
      },
    },
  ];
  const activeBar =
    active === null ? undefined : (
      <ActiveCourtBar
        court={active}
        groupName={groupNameOf(state, active.origin?.groupId ?? null)}
        onOpen={(courtSessionId) => {
          router.push(courtHref("court", { courtSessionId }));
        }}
      />
    );
  return (
    <Screen aboveTabBar scroll footer={activeBar}>
      <AppHeader
        action={
          <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s }}>
            <BellButton
              unread={unread}
              onPress={() => {
                router.push(notificationsHref);
              }}
            />
            <IconButton accessibilityLabel={strings.groups.createGroup} onPress={goToCreateGroup}>
              <PlusIcon />
            </IconButton>
          </View>
        }
      />
      <Text variant="display" displaySize="displayTitle">
        {greetingText(nickname)}
      </Text>
      {bannerText !== null ? <OfflineBanner text={bannerText} /> : null}
      <GroupsStateView
        state={state}
        onRetry={retry}
        onCreateGroup={goToCreateGroup}
        renderList={(groups) => (
          <HomeRoundCards
            groups={groups}
            emptyActions={seeGroups}
            onOpenRound={(groupId, roundId) => {
              router.push(roundHref(groupId, roundId));
            }}
            onOpenSummary={(groupId, roundId) => {
              router.push(summaryHref(groupId, roundId));
            }}
          />
        )}
      />
      {DEV_TOOLS_ENABLED ? (
        <>
          <Button
            label={strings.court.dev.title}
            variant="secondary"
            onPress={() => {
              router.push("/dev/court");
            }}
          />
          <Button
            label={strings.court.dev.catalogLink}
            variant="secondary"
            onPress={() => {
              router.push("/dev/catalog");
            }}
          />
          <Button
            label={strings.court.dev.benchmarkLink}
            variant="secondary"
            onPress={() => {
              router.push("/dev/replay-benchmark");
            }}
          />
        </>
      ) : null}
    </Screen>
  );
}
