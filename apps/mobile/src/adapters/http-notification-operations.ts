import { apiOk, type ApiResult } from "../services/api/api-result";
import type { SacouApi } from "../services/api/sacou-api";
import type { Client, Execute } from "./http-path-params";

async function empty(result: Promise<ApiResult<unknown>>): Promise<ApiResult<null>> {
  const settled = await result;
  return settled.ok ? apiOk(null) : settled;
}

type NotificationOperations = Pick<
  SacouApi,
  | "listNotifications"
  | "markNotificationRead"
  | "markAllNotificationsRead"
  | "registerPushDevice"
  | "removePushDevice"
>;

/**
 * The Notifications module (E3.11): the list of screen 28, its reads and the push device of this
 * install. The push token and the installation id go only in
 * the body: never in a path, a query nor a log.
 */
export function createNotificationOperations(
  client: Client,
  execute: Execute,
): NotificationOperations {
  return {
    listNotifications: () => execute((init) => client.GET("/v1/me/notifications", init)),
    markNotificationRead: (notificationId) =>
      empty(
        execute((init) =>
          client.POST("/v1/me/notifications/{notificationId}/read", {
            ...init,
            params: { path: { notificationId } },
          }),
        ),
      ),
    markAllNotificationsRead: () =>
      empty(execute((init) => client.POST("/v1/me/notifications/read-all", init))),
    // The installation id goes in the body, never in a path: the routes carry no device identifier.
    registerPushDevice: ({ installationId, token, platform }) =>
      empty(
        execute((init) =>
          client.PUT("/v1/me/push-devices", {
            ...init,
            body: { installationId, token, platform },
          }),
        ),
      ),
    removePushDevice: ({ installationId }) =>
      empty(
        execute((init) =>
          client.POST("/v1/me/push-devices/remove", {
            ...init,
            body: { installationId },
          }),
        ),
      ),
  };
}
