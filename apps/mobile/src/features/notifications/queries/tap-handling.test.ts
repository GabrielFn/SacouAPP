import { describe, expect, test, vi } from "vitest";

import { createFakeNotificationTaps } from "../../../adapters/fake-notification-taps";
import { createFakeSacouApi } from "../../../adapters/fake-sacou-api";
import { apiOk } from "../../../services/api/api-result";
import { createSacouQueryClient } from "../../../services/query/query-client";
import { queryKeys } from "../../../services/query/query-keys";
import {
  GROUP_ID,
  NOTIFICATION_ID,
  ROUND_ID,
  notification,
  notificationList,
} from "../model/notification.test.fixture";
import { handleNotificationTap, handlePushReceived, type TapRouting } from "./tap-handling";

const VALID = {
  kind: "waitlistPromoted",
  notificationId: NOTIFICATION_ID,
  groupId: GROUP_ID,
  roundId: ROUND_ID,
};

function setup() {
  const fake = createFakeSacouApi();
  fake.respond("markNotificationRead", apiOk(null));
  const client = createSacouQueryClient();
  client.setQueryData(queryKeys.notifications(), notificationList([notification()]));
  const opened: string[] = [];
  const routing: TapRouting = {
    openRound: (groupId, roundId) => opened.push(`round:${groupId}:${roundId}`),
    openHome: () => opened.push("home"),
  };
  const taps = createFakeNotificationTaps();
  return { fake, client, opened, routing, taps, deps: { api: fake.api, client } };
}

describe("a touched push", () => {
  test("a valid one opens the round and marks it read", async () => {
    const harness = setup();
    harness.client.setQueryData(queryKeys.groups(), [{ groupId: GROUP_ID }]);
    handleNotificationTap(harness.deps, harness.routing, VALID);
    expect(harness.opened).toEqual([`round:${GROUP_ID}:${ROUND_ID}`]);
    await vi.waitFor(() => {
      expect(harness.fake.calls()).toEqual([
        { operation: "markNotificationRead", args: [NOTIFICATION_ID] },
      ]);
    });
  });

  test("M5 a forged one opens the home and calls nothing", () => {
    const harness = setup();
    handleNotificationTap(harness.deps, harness.routing, { ...VALID, url: "sacou://account" });
    expect(harness.opened).toEqual(["home"]);
    expect(harness.fake.calls()).toEqual([]);
  });

  test("a group the person no longer sees opens the home", () => {
    const harness = setup();
    harness.client.setQueryData(queryKeys.groups(), []);
    handleNotificationTap(harness.deps, harness.routing, VALID);
    expect(harness.opened).toEqual(["home"]);
  });

  test("with the app closed, the touch that opened it is read once through the port", async () => {
    const harness = setup();
    harness.taps.openedWith(VALID);
    handleNotificationTap(harness.deps, harness.routing, await harness.taps.lastTap());
    expect(await harness.taps.lastTap()).toBeNull();
    expect(harness.opened).toEqual([`round:${GROUP_ID}:${ROUND_ID}`]);
  });

  test("a push with the app in front reads the list again", () => {
    const harness = setup();
    const stop = harness.taps.onReceived(() => {
      handlePushReceived(harness.deps);
    });
    harness.taps.receive();
    stop();
    expect(harness.client.getQueryState(queryKeys.notifications())?.isInvalidated).toBe(true);
  });
});
