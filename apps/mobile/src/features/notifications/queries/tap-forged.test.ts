import { describe, expect, test } from "vitest";

import { createFakeSacouApi } from "../../../adapters/fake-sacou-api";
import { createSacouQueryClient } from "../../../services/query/query-client";
import { isPersistedKey } from "../../../services/query/persist-policy";
import { queryKeys } from "../../../services/query/query-keys";
import { GROUP_ID, NOTIFICATION_ID, ROUND_ID } from "../model/notification.test.fixture";
import { handleNotificationTap, type TapRouting } from "./tap-handling";

const VALID = {
  kind: "waitlistPromoted",
  notificationId: NOTIFICATION_ID,
  groupId: GROUP_ID,
  roundId: ROUND_ID,
};

describe("forged push data never builds a route from its text", () => {
  test.each([
    ["path traversal in the group", { ...VALID, groupId: "../../admin" }],
    ["an extra field", { ...VALID, route: "/admin" }],
    ["a round that is a URL", { ...VALID, roundId: "https://evil.example/x" }],
    ["a string instead of an object", JSON.stringify(VALID)],
    ["an array", [VALID]],
    ["null", null],
  ])("%s opens only the home", (_name, data) => {
    const fake = createFakeSacouApi();
    const opened: string[] = [];
    const routing: TapRouting = {
      openRound: (groupId, roundId) => opened.push(`round:${groupId}:${roundId}`),
      openHome: () => opened.push("home"),
    };
    handleNotificationTap({ api: fake.api, client: createSacouQueryClient() }, routing, data);
    expect(opened).toEqual(["home"]);
    expect(fake.calls()).toEqual([]);
  });
});

describe("M8 the notifications never reach sacou-cache.db", () => {
  test("the key and any child of it stay out of the persisted cache", () => {
    expect(isPersistedKey(queryKeys.notifications())).toBe(false);
    expect(isPersistedKey(["me", "notifications", "unread"] as never)).toBe(false);
  });
});
