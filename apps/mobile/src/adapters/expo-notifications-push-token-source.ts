import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type {
  PushPlatform,
  PushToken,
  PushTokenSource,
} from "../features/notifications/ports/push-token-source";
import { ensureWaitlistChannel } from "./expo-notifications-channel";

interface EasExtra {
  readonly eas?: { readonly projectId?: unknown };
}

/** The EAS project of `app.json`: the Expo push token is of this project. */
function projectId(): string | null {
  const extra = Constants.expoConfig?.extra as EasExtra | undefined;
  const id = extra?.eas?.projectId;
  return typeof id === "string" ? id : null;
}

function platform(): PushPlatform | null {
  if (Platform.OS === "android") return "android";
  if (Platform.OS === "ios") return "ios";
  return null;
}

/**
 * The Expo push token. It never reaches a log, an error nor the cache: a failure of the system (an
 * emulator with no Google services, no network) is only `null`.
 */
async function readToken(): Promise<PushToken | null> {
  const id = projectId();
  const os = platform();
  if (id === null || os === null) return null;
  try {
    await ensureWaitlistChannel();
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    return { token: data, platform: os };
  } catch {
    return null;
  }
}

export const expoNotificationsPushTokenSource: PushTokenSource = {
  getToken: readToken,
  onTokenChange(listener) {
    // The system gives the new device token; the Expo token is read again from it.
    const subscription = Notifications.addPushTokenListener(() => {
      void readToken().then((token) => {
        if (token !== null) listener(token);
      });
    });
    return () => {
      subscription.remove();
    };
  },
  unregister: () => Notifications.unregisterForNotificationsAsync(),
};
