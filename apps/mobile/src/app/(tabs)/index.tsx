import { useRouter } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

import { DEV_TOOLS_ENABLED } from "../../config/dev-tools";
import { useResumeOnce } from "../../features/court/hooks/resume-context";
import { courtHref } from "../../features/court/navigation";
import { takeResumeTarget } from "../../features/court/session/resume-target";
import { useGroupsScreen } from "../../features/groups/hooks/use-groups-screen";
import { createGroupHref, groupsHref, notificationsHref } from "../../features/groups/navigation";
import { GroupsStateView } from "../../features/groups/ui/GroupsStateView";
import { strings } from "../../strings/pt-BR";
import { useTheme } from "../../theme/theme-context";
import { AppHeader } from "../../ui/AppHeader";
import { BellIcon, PlusIcon } from "../../ui/Icons";
import { Button } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { IconButton } from "../../ui/IconButton";
import { OfflineBanner } from "../../ui/OfflineBanner";
import { Screen } from "../../ui/Screen";
import { Text } from "../../ui/Text";

const { home } = strings.groups;

/** The home (screen 03). A match in progress brings the user back to the court after a restart (E4.9). */
export default function HomeScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const resume = useResumeOnce();
  const { state, bannerText, retry } = useGroupsScreen();
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
  return (
    <Screen aboveTabBar scroll>
      <AppHeader
        action={
          <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s }}>
            <IconButton
              accessibilityLabel={home.notifications}
              onPress={() => {
                router.push(notificationsHref);
              }}
            >
              <BellIcon />
            </IconButton>
            <IconButton accessibilityLabel={strings.groups.createGroup} onPress={goToCreateGroup}>
              <PlusIcon />
            </IconButton>
          </View>
        }
      />
      <Text variant="display" displaySize="displayTitle">
        {home.greeting}
      </Text>
      {bannerText !== null ? <OfflineBanner text={bannerText} /> : null}
      <GroupsStateView
        state={state}
        onRetry={retry}
        onCreateGroup={goToCreateGroup}
        renderList={() => (
          <EmptyState title={home.noRoundsTitle} body={home.noRoundsBody} actions={seeGroups} />
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
