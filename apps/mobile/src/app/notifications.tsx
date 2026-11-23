import { useRouter } from "expo-router";

import { homeHref } from "../features/groups/navigation";
import { useNotificationsScreen } from "../features/notifications/hooks/use-notifications-screen";
import { NotificationsHeader } from "../features/notifications/ui/NotificationsHeader";
import { NotificationsBodyView } from "../features/notifications/ui/NotificationsBodyView";
import { PermissionCard } from "../features/notifications/ui/PermissionCard";
import { roundHref } from "../features/rounds/navigation";
import { Screen } from "../ui/Screen";

/** The notifications (screen 28): the permission card, the list by day and "Marcar como lidas" (E3.11). */
export default function NotificationsScreen() {
  const router = useRouter();
  const { view, activate, markAllRead, markRead, retry } = useNotificationsScreen();
  return (
    <Screen scroll>
      <NotificationsHeader
        canMarkAll={view.canMarkAll}
        onBack={() => {
          if (router.canGoBack()) router.back();
          else router.replace(homeHref);
        }}
        onMarkAll={markAllRead}
      />
      {view.permissionCard !== null ? (
        <PermissionCard card={view.permissionCard} onActivate={activate} />
      ) : null}
      <NotificationsBodyView
        body={view.body}
        onRetry={retry}
        onOpen={(notificationId, groupId, roundId) => {
          markRead(notificationId);
          router.push(roundHref(groupId, roundId));
        }}
      />
    </Screen>
  );
}
