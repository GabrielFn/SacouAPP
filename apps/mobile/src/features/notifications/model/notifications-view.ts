import { apiErrorOf, type ApiError } from "../../../services/api/api-error";
import type { NotificationList } from "../../../services/api/sacou-api";
import { groupByDay, type DayClock, type NotificationDay } from "./group-by-day";
import {
  activationOf,
  showsPermissionCard,
  type PermissionActivation,
  type PushPermissionState,
} from "./push-permission.reducer";

/** What the list query says, as plain data, so the selector needs no React. */
export interface NotificationsQuerySnapshot {
  readonly status: "pending" | "error" | "success";
  readonly fetchStatus: "fetching" | "paused" | "idle";
  readonly data: NotificationList | undefined;
  readonly error: unknown;
}

export type NotificationsBody =
  | { readonly kind: "loading" }
  | { readonly kind: "offline-empty" }
  | { readonly kind: "error"; readonly error: ApiError }
  | { readonly kind: "empty" }
  | { readonly kind: "list"; readonly days: readonly NotificationDay[] };

export interface NotificationsView {
  readonly body: NotificationsBody;
  /** "Marcar como lidas" works only when something is unread (it shows always, as in the canvas). */
  readonly canMarkAll: boolean;
  /** `null`: no card (given, or not known yet). */
  readonly permissionCard: Exclude<PermissionActivation, "none"> | "asking" | null;
}

const UNKNOWN_ERROR: ApiError = { kind: "unexpected", status: 0 };

function bodyOf(query: NotificationsQuerySnapshot, clock: DayClock): NotificationsBody {
  if (query.data !== undefined) {
    return query.data.items.length === 0
      ? { kind: "empty" }
      : { kind: "list", days: groupByDay(query.data.items, clock) };
  }
  if (query.status === "error") {
    return { kind: "error", error: apiErrorOf(query.error) ?? UNKNOWN_ERROR };
  }
  return query.fetchStatus === "paused" ? { kind: "offline-empty" } : { kind: "loading" };
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
