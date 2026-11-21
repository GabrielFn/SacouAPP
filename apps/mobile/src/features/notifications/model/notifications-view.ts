import type { NotificationList } from "../../../services/api/sacou-api";
import {
  queryViewState,
  type QuerySnapshot,
  type QueryWaitState,
} from "../../../services/query/query-view-state";
import { groupByDay, type DayClock, type NotificationDay } from "./group-by-day";
import {
  activationOf,
  showsPermissionCard,
  type PermissionActivation,
  type PushPermissionState,
} from "./push-permission.reducer";

/** What the list query says, as plain data, so the selector needs no React. */
export type NotificationsQuerySnapshot = QuerySnapshot<NotificationList>;

export type NotificationsBody =
  | QueryWaitState
  | { readonly kind: "empty" }
  | { readonly kind: "list"; readonly days: readonly NotificationDay[] };

export interface NotificationsView {
  readonly body: NotificationsBody;
  /** "Marcar como lidas" works only when something is unread (it shows always, as in the canvas). */
  readonly canMarkAll: boolean;
  /** `null`: no card (given, or not known yet). */
  readonly permissionCard: Exclude<PermissionActivation, "none"> | "asking" | null;
}

function bodyOf(query: NotificationsQuerySnapshot, clock: DayClock): NotificationsBody {
  return queryViewState(query, (list): NotificationsBody =>
    list.items.length === 0
      ? { kind: "empty" }
      : { kind: "list", days: groupByDay(list.items, clock) },
  );
}

function cardOf(permission: PushPermissionState): NotificationsView["permissionCard"] {
  if (!showsPermissionCard(permission)) return null;
  const activation = activationOf(permission);
  return activation === "none" ? "asking" : activation;
}

/** Screen 28 from the one record of the list and the state of the permission, derived each render. */
export function notificationsView(
  query: NotificationsQuerySnapshot,
  permission: PushPermissionState,
  clock: DayClock,
): NotificationsView {
  return {
    body: bodyOf(query, clock),
    canMarkAll: (query.data?.unreadCount ?? 0) > 0,
    permissionCard: cardOf(permission),
  };
}
