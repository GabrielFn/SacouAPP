import * as Notifications from "expo-notifications";

import type { NotificationTaps } from "../features/notifications/ports/notification-taps";

/** Only the touch on the push itself: an action button (none exists yet) is not a tap. */
function dataOf(response: Notifications.NotificationResponse | null): unknown {
  if (response === null) return null;
  if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return null;
  return response.notification.request.content.data;
}

/** The touches through `expo-notifications`; the `data` goes out unread, as `unknown`. */
export const expoNotificationsTaps: NotificationTaps = {
  lastTap: async () => {
    try {
      const response = await Notifications.getLastNotificationResponseAsync();
      // Read once: another login on the same opening never acts on the same touch again.
      await Notifications.clearLastNotificationResponseAsync();
      return dataOf(response);
    } catch {
      return null;
    }
  },
  onTap(listener) {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      Notifications.clearLastNotificationResponse();
      listener(dataOf(response));
    });
    return () => {
      subscription.remove();
    };
  },
  onReceived(listener) {
    const subscription = Notifications.addNotificationReceivedListener(() => {
      listener();
    });
    return () => {
      subscription.remove();
    };
  },
};
