import { describe, expect, test } from "vitest";

import { parseNotificationTap, tapTarget } from "./notification-tap";
import { GROUP_ID, NOTIFICATION_ID, ROUND_ID } from "./notification.test.fixture";

const VALID = {
  kind: "waitlistPromoted",
  notificationId: NOTIFICATION_ID,
  groupId: GROUP_ID,
  roundId: ROUND_ID,
};
const MINE: ReadonlySet<string> = new Set([GROUP_ID]);

describe("M5 the data of a touched push", () => {
  test("a valid one opens the round of the group", () => {
    expect(tapTarget(VALID, MINE)).toEqual({ kind: "round", groupId: GROUP_ID, roundId: ROUND_ID });
    expect(parseNotificationTap(VALID)).toEqual(VALID);
  });

  test("before the groups are read, the round screen judges the access", () => {
    expect(tapTarget(VALID, null)).toEqual({ kind: "round", groupId: GROUP_ID, roundId: ROUND_ID });
  });

  test("upper case ids are read as the lower case the API writes", () => {
    const upper = { ...VALID, groupId: GROUP_ID.toUpperCase() };
    expect(tapTarget(upper, MINE)).toEqual({ kind: "round", groupId: GROUP_ID, roundId: ROUND_ID });
  });

  test.each([
    ["an id that is not a UUID", { ...VALID, roundId: "../../account/delete" }],
    ["a route in the group id", { ...VALID, groupId: "/account" }],
    ["an unknown kind", { ...VALID, kind: "openUrl" }],
    ["a field too many", { ...VALID, url: "https://evil.example" }],
    ["a field missing", { kind: VALID.kind, groupId: GROUP_ID, roundId: ROUND_ID }],
    ["a number for an id", { ...VALID, notificationId: 7 }],
    ["an array", [VALID]],
    ["a string", JSON.stringify(VALID)],
    ["null", null],
    ["nothing", undefined],
  ])("%s opens the home", (_name, data) => {
    expect(parseNotificationTap(data)).toBeNull();
    expect(tapTarget(data, MINE)).toEqual({ kind: "home" });
  });

  test("a group the person does not see opens the home", () => {
    expect(tapTarget(VALID, new Set(["8a4c2f0e-9999-4c3b-9d2e-0000000000dd"]))).toEqual({
      kind: "home",
    });
  });
});
