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

/** A device token as text, to tell a new one from the one already seen. */
function deviceTokenKey(deviceToken: Notifications.DevicePushToken): string {
  const data: unknown = deviceToken.data;
  return typeof data === "string" ? data : JSON.stringify(data);
}

/**
 * Every native read of the device token emits the push token event again (Android `PushTokenModule`
 * calls `onNewToken` after `getDevicePushTokenAsync`), and reading the Expo token reads the device
 * token. So the listener only reads when the device token is new, and never while a read is on the
 * way: otherwise each read fires the next one, a loop of `PUT /v1/me/push-devices`.
 */
function createExpoNotificationsPushTokenSource(): PushTokenSource {
  const seen: { deviceToken: string | null } = { deviceToken: null };

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
      const devicePushToken = await Notifications.getDevicePushTokenAsync();
      seen.deviceToken = deviceTokenKey(devicePushToken);
      const { data } = await Notifications.getExpoPushTokenAsync({ projectId: id, devicePushToken });
      return { token: data, platform: os };
    } catch {
      return null;
    }
  }

  return {
    getToken: readToken,
    onTokenChange(listener) {
      const state: { reading: boolean; pending: string | null; active: boolean } = {
        reading: false,
        pending: null,
        active: true,
      };

      async function readWhileNew(): Promise<void> {
        state.reading = true;
        try {
          while (state.active && state.pending !== null && state.pending !== seen.deviceToken) {
            state.pending = null;
            const token = await readToken();
            if (token !== null && state.active) listener(token);
          }
        } finally {
          state.pending = null;
          state.reading = false;
        }
      }

      const subscription = Notifications.addPushTokenListener((deviceToken) => {
        state.pending = deviceTokenKey(deviceToken);
        if (!state.reading) void readWhileNew();
      });
      return () => {
        state.active = false;
        subscription.remove();
      };
    },
    unregister: () => Notifications.unregisterForNotificationsAsync(),
  };
}

export const expoNotificationsPushTokenSource: PushTokenSource =
  createExpoNotificationsPushTokenSource();
