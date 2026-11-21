import { describe, expect, test, vi } from "vitest";

import { createFakeSacouApi } from "../../../adapters/fake-sacou-api";
import { apiErr, apiOk, type ApiResult } from "../../../services/api/api-result";
import type { NotificationList, SacouApi } from "../../../services/api/sacou-api";
import { createSacouQueryClient } from "../../../services/query/query-client";
import { queryKeys } from "../../../services/query/query-keys";
import { notification, notificationList } from "../model/notification.test.fixture";
import {
  hasUnread,
  markAllNotificationsRead,
  markNotificationRead,
  notificationsQuery,
} from "./notification-queries";

const A = "8a4c2f0e-3333-4c3b-9d2e-0000000000a1";
const B = "8a4c2f0e-3333-4c3b-9d2e-0000000000b2";
const KEY = queryKeys.notifications();

function setup() {
  const fake = createFakeSacouApi();
  const client = createSacouQueryClient();
  const server = notificationList([notification({ id: A }), notification({ id: B })]);
  client.setQueryData(KEY, server);
  return { fake, client, server, deps: { api: fake.api, client } };
}

const listOf = (client: ReturnType<typeof createSacouQueryClient>) =>
  client.getQueryData<NotificationList>(KEY);

/** A read-all that answers only when the test lets it, to look at the cache meanwhile. */
function slowReadAll(fake: ReturnType<typeof createFakeSacouApi>) {
  const pending: { release: (result: ApiResult<null>) => void } = { release: () => undefined };
  const sent = { value: false };
  const api: SacouApi = {
    ...fake.api,
    markAllNotificationsRead: () => {
      sent.value = true;
      return new Promise((resolve) => {
        pending.release = resolve;
      });
    },
  };
  return { api, sent, release: (result: ApiResult<null>) => pending.release(result) };
}

describe("M6 Marcar como lidas, optimistic", () => {
  test("all read before the answer, and kept on 204", async () => {
    const { fake, client } = setup();
    const slow = slowReadAll(fake);
    const sending = markAllNotificationsRead({ api: slow.api, client });
    await vi.waitFor(() => {
      expect(slow.sent.value).toBe(true);
    });
    expect(listOf(client)?.unreadCount).toBe(0);
    slow.release(apiOk(null));
    expect((await sending).ok).toBe(true);
    expect(listOf(client)?.items.every((item) => item.read)).toBe(true);
    expect(client.getQueryState(KEY)?.isInvalidated).toBe(false);
  });

  test("a failure brings the server's state back and reads it again", async () => {
    const { fake, client, deps, server } = setup();
    fake.respond("markAllNotificationsRead", apiErr({ kind: "offline" }));
    const result = await markAllNotificationsRead(deps);
    expect(result.ok).toBe(false);
    expect(listOf(client)).toEqual(server);
    expect(client.getQueryState(KEY)?.isInvalidated).toBe(true);
  });

  test("one row read lowers the count by one, and a second time changes nothing", async () => {
    const { fake, client, deps } = setup();
    fake.respond("markNotificationRead", apiOk(null));
    await markNotificationRead(deps, A);
    await markNotificationRead(deps, A);
    expect(listOf(client)?.unreadCount).toBe(1);
    expect(listOf(client)?.items.map((item) => item.read)).toEqual([true, false]);
    expect(fake.calls().map((call) => call.args)).toEqual([[A], [A]]);
  });

  test("one row that fails goes back unread", async () => {
    const { fake, client, deps, server } = setup();
    fake.respond("markNotificationRead", apiErr({ kind: "unavailable" }));
    await markNotificationRead(deps, B);
    expect(listOf(client)).toEqual(server);
  });

  test("with no list in the cache the call still goes and nothing is made up", async () => {
    const fake = createFakeSacouApi();
    const client = createSacouQueryClient();
    fake.respond("markAllNotificationsRead", apiOk(null));
    await markAllNotificationsRead({ api: fake.api, client });
    expect(listOf(client)).toBeUndefined();
    expect(fake.calls()).toHaveLength(1);
  });
});

describe("M7 the dot of the bell", () => {
  test("derived from unreadCount: it goes away at zero", () => {
    expect(hasUnread(notificationList([notification()]))).toBe(true);
    expect(hasUnread(notificationList([notification({ read: true })]))).toBe(false);
    expect(hasUnread(undefined)).toBe(false);
  });

  test("the query reads the list under the one key", async () => {
    const fake = createFakeSacouApi();
    const client = createSacouQueryClient();
    const list = notificationList([notification()]);
    fake.respond("listNotifications", apiOk(list));
    await client.fetchQuery(notificationsQuery(fake.api));
    expect(client.getQueryData(KEY)).toEqual(list);
    expect(KEY).toEqual(["me", "notifications"]);
  });
});
