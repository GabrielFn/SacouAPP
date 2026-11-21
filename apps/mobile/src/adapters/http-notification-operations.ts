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
 * install. The push token goes only in the body of the `PUT`: never in a path, a query nor a log.
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
    // The routes of Part 1 still carry the installation id in the path; Part 2 moves it into the body
    // (`PUT /v1/me/push-devices`, `POST /v1/me/push-devices/remove`): only these two calls change then.
    registerPushDevice: ({ installationId, token, platform }) =>
      empty(
        execute((init) =>
          client.PUT("/v1/me/push-devices/{installationId}", {
            ...init,
            params: { path: { installationId } },
            body: { token, platform },
          }),
        ),
      ),
    removePushDevice: ({ installationId }) =>
      empty(
        execute((init) =>
          client.DELETE("/v1/me/push-devices/{installationId}", {
            ...init,
            params: { path: { installationId } },
          }),
        ),
      ),
  };
}
