import * as Notifications from "expo-notifications";
import { Linking } from "react-native";

import type {
  NotificationPermission,
  PermissionAnswer,
} from "../features/notifications/ports/notification-permission";
import { ensureWaitlistChannel } from "./expo-notifications-channel";

/** iOS gives a quiet trial permission ("provisional"): the pushes arrive, so it counts as given. */
const PROVISIONAL = Notifications.IosAuthorizationStatus.PROVISIONAL;

function answerOf(status: Notifications.NotificationPermissionsStatus): PermissionAnswer {
  if (status.granted || status.ios?.status === PROVISIONAL) return "granted";
  return status.canAskAgain ? "askable" : "blocked";
}

/** The system permission through `expo-notifications`; a failure of the system reads as askable. */
export const expoNotificationsPermission: NotificationPermission = {
  status: async () => {
    try {
      return answerOf(await Notifications.getPermissionsAsync());
    } catch {
      return "askable";
    }
  },
  request: async () => {
    try {
      await ensureWaitlistChannel();
      return answerOf(await Notifications.requestPermissionsAsync());
    } catch {
      return "askable";
    }
  },
  openSettings: async () => {
    try {
      await Linking.openSettings();
    } catch {
      // No settings page to open: the card stays, nothing else to do.
    }
  },
};
