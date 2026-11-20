import { QueryClient } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";

import { ApiFailure, type ApiError } from "../api/api-error";
import {
  cacheEffectsOf,
  conflictEffects,
  groupGoneEffects,
  isConflict,
  type MutationEvent,
} from "./invalidation";
import { cacheBuster, isPersistedKey, shouldPersistQuery } from "./persist-policy";
import { queryKeys } from "./query-keys";
import { queryRetryDelay, shouldRetryQuery } from "./retry-policy";

const G = "group-1";
const failure = (error: ApiError) => new ApiFailure(error);

describe("shouldRetryQuery (P4)", () => {
  test.each<[string, ApiError]>([
    ["offline", { kind: "offline" }],
    ["unavailable", { kind: "unavailable", retryAfterMs: 5_000 }],
    ["a 5xx", { kind: "unexpected", status: 502 }],
  ])("%s is tried again twice, not three times", (_name, error) => {
    expect([0, 1, 2].map((count) => shouldRetryQuery(count, failure(error)))).toEqual([
      true,
      true,
      false,
    ]);
  });

  test.each<[string, ApiError]>([
    ["a rule error", { kind: "problem", status: 404, code: "groups.group-not-found" }],
    ["an expired session", { kind: "session-expired" }],
    ["too large", { kind: "too-large" }],
    ["a 4xx without code", { kind: "unexpected", status: 400 }],
    ["a request never sent", { kind: "unexpected", status: 0 }],
    ["a 429, which would only spend the quota", { kind: "rate-limited", retryAfterMs: 1_000 }],
  ])("%s is never tried again", (_name, error) => {
    expect(shouldRetryQuery(0, failure(error))).toBe(false);
  });

  test("anything that is not an ApiFailure is not tried again", () => {
    expect(shouldRetryQuery(0, new Error("bug"))).toBe(false);
  });

  test("the delay is the Retry-After of a 503, otherwise 1 s then 2 s", () => {
    expect(queryRetryDelay(0, failure({ kind: "unavailable", retryAfterMs: 7_000 }))).toBe(7_000);
    expect(queryRetryDelay(0, failure({ kind: "offline" }))).toBe(1_000);
    expect(queryRetryDelay(1, failure({ kind: "offline" }))).toBe(2_000);
  });
});

describe("cacheEffectsOf (P5, golden)", () => {
  const golden: readonly [MutationEvent, readonly string[]][] = [
    [{ type: "createGroup" }, ["invalidate groups"]],
    [{ type: "acceptInvite" }, ["invalidate groups"]],
    [{ type: "renameGroup", groupId: G }, [`invalidate groups/${G}`, "invalidate groups"]],
    [{ type: "leaveGroup", groupId: G }, [`remove groups/${G}`, "invalidate groups"]],
    [{ type: "createInvite", groupId: G }, [`invalidate groups/${G}/invites`]],
    [{ type: "revokeInvite", groupId: G }, [`invalidate groups/${G}/invites`]],
    [{ type: "memberLevelsChanged", groupId: G }, [`invalidate groups/${G}/member-levels`]],
    [{ type: "settingsReplaced", groupId: G, view: {} }, [`set groups/${G}/settings`]],
    [{ type: "templatesChanged", groupId: G }, [`invalidate groups/${G}/templates`]],
    [
      { type: "settingsForbidden", groupId: G },
      [`invalidate groups/${G}`, `invalidate groups/${G}/settings`],
    ],
    ...(["roundCreated", "roundUpdated"] as const).map(
      (type): [MutationEvent, readonly string[]] => [
        { type, groupId: G, roundId: "r1", round: {} },
        [`set groups/${G}/rounds/r1`, `invalidateExact groups/${G}/rounds`],
      ],
    ),
    [
      { type: "attendanceChanged", groupId: G, roundId: "r1" },
      [`invalidate groups/${G}/rounds/r1`, `invalidateExact groups/${G}/rounds`],
    ],
    [
      { type: "profileSaved", profile: {}, nickname: "Ana", cachedGroupIds: [G, "g2"] },
      ["set me/profile", `invalidate groups/${G}/members`, "invalidate groups/g2/members"],
    ],
    [
      { type: "profileSaved", profile: {}, nickname: "Ana", cachedGroupIds: [] },
      ["set me/profile"],
    ],
    ...(["changeMemberRole", "changeMemberType", "removeMember"] as const).flatMap(
      (type): [MutationEvent, readonly string[]][] => [
        [
          { type, groupId: G, targetIsMe: false },
          [`invalidate groups/${G}/members`, "invalidate me/deletion-blockers"],
        ],
        [
          { type, groupId: G, targetIsMe: true },
          [
            `invalidate groups/${G}/members`,
            "invalidate groups",
            "invalidate me/deletion-blockers",
          ],
        ],
      ],
    ),
  ];

  test.each(golden)("%o", (event, expected) => {
    expect(
      cacheEffectsOf(event).map((effect) => `${effect.action} ${effect.key.join("/")}`),
    ).toEqual(expected);
  });

  test.each([
    ["groups.last-admin", `groups/${G}/members`],
    ["groups.invite-limit", `groups/${G}/invites`],
    ["groups.template-limit", `groups/${G}/templates`],
  ] as const)("a 409 %s makes %s stale", (code, key) => {
    const effects = conflictEffects(G, failure({ kind: "problem", status: 409, code }));
    expect(effects.map((effect) => `${effect.action} ${effect.key.join("/")}`)).toEqual([
      `invalidate ${key}`,
    ]);
  });

  test("a 409 without a rule that says what is old, or another status, touches nothing", () => {
    expect(
      conflictEffects(
        G,
        failure({ kind: "problem", status: 409, code: "groups.membership-limit" }),
      ),
    ).toEqual([]);
    expect(
      conflictEffects(G, failure({ kind: "problem", status: 403, code: "groups.last-admin" })),
    ).toEqual([]);
  });

  test("a 409 refreshes; other errors do not", () => {
    expect(isConflict(failure({ kind: "problem", status: 409, code: "groups.last-admin" }))).toBe(
      true,
    );
    expect(isConflict(failure({ kind: "problem", status: 403, code: "groups.forbidden" }))).toBe(
      false,
    );
  });

  test("a group that is gone leaves the cache only when the key is of that group", () => {
    const gone = failure({ kind: "problem", status: 404, code: "groups.group-not-found" });
    expect(groupGoneEffects(queryKeys.members(G), gone)).toEqual([
      { action: "remove", key: ["groups", G] },
      { action: "invalidate", key: ["groups"] },
    ]);
    expect(groupGoneEffects(queryKeys.groups(), gone)).toEqual([]);
    expect(groupGoneEffects(queryKeys.group(G), failure({ kind: "offline" }))).toEqual([]);
  });
});

describe("the allow list of the persisted cache (P6)", () => {
  test.each([
    [queryKeys.groups(), true],
    [queryKeys.group(G), true],
    [queryKeys.members(G), true],
    [queryKeys.settings(G), true],
    [queryKeys.rounds(G), true],
    [queryKeys.round(G, "round-1"), true],
    [["groups", G, "members", "extra"], false],
    [["groups", G, "settings", "round-1"], false],
    [["groups", G, "rounds", 1], false],
    [["groups", G, "rounds", "round-1", "extra"], false],
    [queryKeys.invites(G), false],
    [queryKeys.memberLevels(G), false],
    [queryKeys.courtSummary(G, "round-1"), false],
    [queryKeys.templates(G), false],
    [queryKeys.me(), false],
    [queryKeys.myProfile(), true],
    [queryKeys.myStats(), true],
    [["me", "stats", "x"], false],
    [queryKeys.deletionBlockers(), false],
    [["me", "profile", "x"], false],
    [["me", "nickname"], false],
    [["groups", G, "members", "extra"], false],
    [["groups", 1], false],
    [["unknown"], false],
  ])("%o is persisted: %s", (key, expected) => {
    expect(isPersistedKey(key)).toBe(expected);
  });

  test.each(["error", "pending", "success"] as const)(
    "a query in %s is written: only success",
    (status) => {
      const client = new QueryClient();
      const query = client.getQueryCache().build(client, { queryKey: queryKeys.groups() });
      query.setState({ status });
      expect(shouldPersistQuery(query)).toBe(status === "success");
    },
  );

  test("an error that kept its last answer is written only for an allowed key", () => {
    const client = new QueryClient();
    const allowed = client.getQueryCache().build(client, { queryKey: queryKeys.groups() });
    allowed.setState({ status: "error", data: [], error: failure({ kind: "offline" }) });
    expect(shouldPersistQuery(allowed)).toBe(true);
    const denied = client.getQueryCache().build(client, { queryKey: queryKeys.me() });
    denied.setState({ status: "error", data: {}, error: failure({ kind: "offline" }) });
    expect(shouldPersistQuery(denied)).toBe(false);
  });

  test.each<[string, ApiError, boolean]>([
    ["no network", { kind: "offline" }, true],
    ["the server down", { kind: "unavailable", retryAfterMs: 0 }, true],
    ["too many requests (429)", { kind: "rate-limited", retryAfterMs: 0 }, true],
    [
      "removed from the group (403)",
      { kind: "problem", status: 403, code: "groups.forbidden" },
      false,
    ],
    [
      "the group gone (404)",
      { kind: "problem", status: 404, code: "groups.group-not-found" },
      false,
    ],
    ["an expired session", { kind: "session-expired" }, false],
    ["a user not registered", { kind: "not-registered" }, false],
    ["an unexpected answer", { kind: "unexpected", status: 500 }, false],
  ])("the last answer is kept on disk after %s: %s", (_name, error, kept) => {
    const client = new QueryClient();
    const query = client.getQueryCache().build(client, { queryKey: queryKeys.groups() });
    query.setState({ status: "error", data: [], error: failure(error) });
    expect(shouldPersistQuery(query)).toBe(kept);
  });

  test("the buster joins the app version and the contract", () => {
    expect(cacheBuster("1.2.3")).toMatch(/^1\.2\.3\+[0-9a-f]{16}$/);
  });
});
