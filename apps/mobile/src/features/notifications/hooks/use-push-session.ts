import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect } from "react";

import { useServices } from "../../../services/services-context";
import { homeHref } from "../../groups/navigation";
import { roundHref } from "../../rounds/navigation";
import { hasUnread, notificationsQuery } from "../queries/notification-queries";
import { handleNotificationTap, handlePushReceived } from "../queries/tap-handling";
import { syncWithOneRetry } from "../registration/sync-with-one-retry";

/**
 * While signed in: the phone registers on every opening and on every token change, and the touches on
 * the pushes open their round (E3.11, Part 3, items 3 and 7). Signed out, nothing runs: no registration
 * ever leaves without a session.
 */
export function usePushSession(signedIn: boolean): void {
  const { sacouApi, pushDevices, notificationTaps, scheduler, pushOutcomeLog } = useServices();
  const client = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    if (!signedIn) return undefined;
    // With the permission already given, the opening registers the phone (R98, item 9).
    const cancelRetry = syncWithOneRetry({ devices: pushDevices, scheduler, log: pushOutcomeLog });
    const stop = pushDevices.start();
    return () => {
      cancelRetry();
      stop();
    };
  }, [signedIn, pushDevices, scheduler, pushOutcomeLog]);

  useEffect(() => {
    if (!signedIn) return undefined;
    const deps = { api: sacouApi, client };
    const routing = {
      openRound: (groupId: string, roundId: string) => {
        router.push(roundHref(groupId, roundId));
      },
      openHome: () => {
        router.navigate(homeHref);
      },
    };
    const alive = { value: true };
    void notificationTaps.lastTap().then((data) => {
      if (alive.value && data !== null && data !== undefined) {
        handleNotificationTap(deps, routing, data);
      }
    });
    const stopTaps = notificationTaps.onTap((data) => {
      handleNotificationTap(deps, routing, data);
    });
    const stopReceived = notificationTaps.onReceived(() => {
      handlePushReceived(deps);
    });
    return () => {
      alive.value = false;
      stopTaps();
      stopReceived();
    };
  }, [signedIn, sacouApi, client, router, notificationTaps]);
}

/** The dot of the bell of the home, derived from the `unreadCount` of the list (M7). */
export function useHasUnreadNotifications(): boolean {
  const { sacouApi } = useServices();
  return useQuery({ ...notificationsQuery(sacouApi), select: hasUnread }).data ?? false;
}
