import { queryOptions, type QueryClient } from "@tanstack/react-query";

import { unwrap, type ApiResult } from "../../../services/api/api-result";
import type { NotificationList, SacouApi } from "../../../services/api/sacou-api";
import { queryKeys } from "../../../services/query/query-keys";

/** A new promotion comes as a push, which reads the list again: between pushes 30 s is fresh. */
export const NOTIFICATIONS_STALE_MS = 30_000;

export function notificationsQuery(api: SacouApi) {
  return queryOptions({
    queryKey: queryKeys.notifications(),
    queryFn: () => unwrap(api.listNotifications()),
    staleTime: NOTIFICATIONS_STALE_MS,
    refetchOnWindowFocus: true,
  });
}

/** The dot of the bell, derived from the one record of the count (frontend.md, rule 1). */
export function hasUnread(list: NotificationList | undefined): boolean {
  return (list?.unreadCount ?? 0) > 0;
}

export interface NotificationReadDeps {
  readonly api: SacouApi;
  readonly client: Pick<
    QueryClient,
    "cancelQueries" | "getQueryData" | "setQueryData" | "invalidateQueries"
  >;
}

function readOne(list: NotificationList, notificationId: string): NotificationList {
  const target = list.items.find((item) => item.id === notificationId);
  if (target === undefined || target.read) return list;
  return {
    ...list,
    items: list.items.map((item) => (item.id === notificationId ? { ...item, read: true } : item)),
    unreadCount: Math.max(0, list.unreadCount - 1),
  };
}

function readAll(list: NotificationList): NotificationList {
  return { ...list, items: list.items.map((item) => ({ ...item, read: true })), unreadCount: 0 };
}

/**
 * Optimistic in the cache itself: the list changes before the answer; on a failure it goes back to what
 * it was and is read again, so the screen ends with the server's state (M6).
 */
async function optimistic(
  deps: NotificationReadDeps,
  change: (list: NotificationList) => NotificationList,
  send: () => Promise<ApiResult<null>>,
): Promise<ApiResult<null>> {
  const key = queryKeys.notifications();
  await deps.client.cancelQueries({ queryKey: key });
  const before = deps.client.getQueryData<NotificationList>(key);
  if (before !== undefined) deps.client.setQueryData<NotificationList>(key, change(before));
  const result = await send();
  if (!result.ok) {
    deps.client.setQueryData<NotificationList>(key, before);
    void deps.client.invalidateQueries({ queryKey: key });
  }
  return result;
}

export function markNotificationRead(
  deps: NotificationReadDeps,
  notificationId: string,
): Promise<ApiResult<null>> {
  return optimistic(
    deps,
    (list) => readOne(list, notificationId),
    () => deps.api.markNotificationRead(notificationId),
  );
}

export function markAllNotificationsRead(deps: NotificationReadDeps): Promise<ApiResult<null>> {
  return optimistic(deps, readAll, () => deps.api.markAllNotificationsRead());
}
