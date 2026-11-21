import { describe, expect, test } from "vitest";

import { ApiFailure } from "../../../services/api/api-error";
import type { NotificationList } from "../../../services/api/sacou-api";
import { notification, notificationList } from "./notification.test.fixture";
import { notificationsView, type NotificationsQuerySnapshot } from "./notifications-view";

const CLOCK = { nowMs: Date.parse("2026-11-19T13:00:00.000Z"), offsetMinutes: 180 };

function query(
  data: NotificationList | undefined,
  overrides: Partial<NotificationsQuerySnapshot> = {},
): NotificationsQuerySnapshot {
  return {
    status: data === undefined ? "pending" : "success",
    fetchStatus: "idle",
    data,
    error: null,
    ...overrides,
  };
}

describe("the view of screen 28", () => {
  test("a list grouped by day, with Marcar como lidas while one is unread", () => {
    const view = notificationsView(query(notificationList([notification()])), "granted", CLOCK);
    expect(view.body).toMatchObject({ kind: "list", days: [{ label: "Hoje" }] });
    expect(view.canMarkAll).toBe(true);
    expect(view.permissionCard).toBeNull();
  });

  test("all read: no Marcar como lidas", () => {
    const list = notificationList([notification({ read: true })]);
    expect(notificationsView(query(list), "granted", CLOCK).canMarkAll).toBe(false);
  });

  test("an empty list is the empty state", () => {
    expect(notificationsView(query(notificationList([])), "granted", CLOCK).body).toEqual({
      kind: "empty",
    });
  });

  test("loading, offline with nothing, and an error", () => {
    expect(notificationsView(query(undefined), "unknown", CLOCK).body).toEqual({ kind: "loading" });
    expect(
      notificationsView(query(undefined, { fetchStatus: "paused" }), "unknown", CLOCK).body,
    ).toEqual({ kind: "offline-empty" });
    const failed = query(undefined, {
      status: "error",
      error: new ApiFailure({ kind: "unavailable", retryAfterMs: 0 }),
    });
    expect(notificationsView(failed, "unknown", CLOCK).body).toEqual({
      kind: "error",
      error: { kind: "unavailable", retryAfterMs: 0 },
    });
  });

  test.each([
    ["unknown", null],
    ["granted", null],
    ["denied", "request"],
    ["asking", "asking"],
    ["blocked", "open-settings"],
  ] as const)("M10 permission %s: card %s", (permission, card) => {
    expect(notificationsView(query(undefined), permission, CLOCK).permissionCard).toBe(card);
  });
});
