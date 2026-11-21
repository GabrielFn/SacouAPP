import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { Platform } from "react-native";

import { notificationsStrings } from "../strings/notifications.pt-BR";

/** The Android channel the server names in every push (`channelId`, E3.11, Part 2, item 7). */
export const WAITLIST_CHANNEL_ID = "sacou-espera";

const created: { current: Promise<void> | null } = { current: null };

/**
 * Android 13 asks the permission only once a channel exists, so it is made before the question and
 * before the token. High importance: the promotion is the one push the person waits for.
 */
export function ensureWaitlistChannel(): Promise<void> {
  if (Platform.OS !== "android") return Promise.resolve();
  created.current ??= Notifications.setNotificationChannelAsync(WAITLIST_CHANNEL_ID, {
    name: notificationsStrings.channelName,
    importance: AndroidImportance.HIGH,
  }).then(
    () => undefined,
    () => {
      created.current = null;
    },
  );
  return created.current;
}

/** With the app in front, the push still shows as a banner and in the list of the system. */
export function showPushesInForeground(): void {
  Notifications.setNotificationHandler({
    handleNotification: () =>
      Promise.resolve({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
  });
}
