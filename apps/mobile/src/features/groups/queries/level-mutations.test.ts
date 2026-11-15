import { MutationObserver, QueryObserver } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";

import { createFakeSacouApi } from "../../../adapters/fake-sacou-api";
import { createMemoryInviteLinkStore } from "../../../adapters/memory-invite-link-store";
import type { ApiError } from "../../../services/api/api-error";
import { apiErr, apiOk } from "../../../services/api/api-result";
import { shouldPersistQuery } from "../../../services/query/persist-policy";
import { createSacouQueryClient } from "../../../services/query/query-client";
import { queryKeys } from "../../../services/query/query-keys";
import { canManageLevels } from "../model/member-actions";
import { GROUP, member } from "../model/members.test.fixture";
import { memberLevelsQuery } from "./group-queries";
import { confirmAll, confirmAllMutation, setLevelMutation } from "./level-mutations";
import { removeMemberMutation } from "./member-mutations";

const LEVELS = [{ memberId: "b", adminLevel: null, reviewed: false, suggestedLevel: 4 }];
const FORBIDDEN: ApiError = { kind: "problem", status: 403, code: "groups.forbidden" };

function setup() {
  const fake = createFakeSacouApi();
  const client = createSacouQueryClient();
  return { fake, client, deps: { api: fake.api, client } };
}

function isStale(client: ReturnType<typeof createSacouQueryClient>, key: readonly unknown[]) {
  return client.getQueryState(key)?.isInvalidated ?? false;
}

describe("who asks for the levels (ADR 0047)", () => {
  test.each(["scorekeeper", "player"] as const)("%s never calls the route", async (role) => {
    const { fake, client } = setup();
    const observer = new QueryObserver(
      client,
      memberLevelsQuery(fake.api, GROUP, canManageLevels(role)),
    );
    const unsubscribe = observer.subscribe(() => undefined);
    await Promise.resolve();
    unsubscribe();
    expect(fake.calls().map((call) => call.operation)).not.toContain("listMemberLevels");
    expect(client.getQueryData(queryKeys.memberLevels(GROUP))).toBeUndefined();
  });

  test("an admin asks, and the answer is never written to the persisted cache", async () => {
    const { fake, client } = setup();
    fake.respond("listMemberLevels", apiOk(LEVELS));
    await client.fetchQuery(memberLevelsQuery(fake.api, GROUP, canManageLevels("coAdmin")));
    const query = client.getQueryCache().find({ queryKey: queryKeys.memberLevels(GROUP) });
    expect(query?.state.data).toEqual(LEVELS);
    expect(query === undefined ? true : shouldPersistQuery(query)).toBe(false);
  });
});

describe("writing a level", () => {
  test("Salvar 3,5 sends 3.5 for the member and reads the levels again", async () => {
    const { fake, client, deps } = setup();
    client.setQueryData(queryKeys.memberLevels(GROUP), LEVELS);
    fake.respond("setMemberLevel", apiOk({ memberId: "b", adminLevel: 3.5, reviewed: true }));
    await new MutationObserver(client, setLevelMutation(deps, GROUP)).mutate({
      memberId: "b",
      level: 3.5,
    });
    expect(fake.calls()).toEqual([
      { operation: "setMemberLevel", args: [{ groupId: GROUP, memberId: "b" }, 3.5] },
    ]);
    expect(isStale(client, queryKeys.memberLevels(GROUP))).toBe(true);
  });

  test("a 403 makes the role stale too, so the screen hides the levels", async () => {
    const { fake, client, deps } = setup();
    client.setQueryData(queryKeys.group(GROUP), { role: "admin" });
    client.setQueryData(queryKeys.memberLevels(GROUP), LEVELS);
    fake.respond("setMemberLevel", apiErr(FORBIDDEN));
    const observer = new MutationObserver(client, setLevelMutation(deps, GROUP));
    await expect(observer.mutate({ memberId: "b", level: 4 })).rejects.toThrow();
    expect(isStale(client, queryKeys.group(GROUP))).toBe(true);
    expect(isStale(client, queryKeys.memberLevels(GROUP))).toBe(true);
  });

  test("Confirmar todas uses the batch route, 50 at a time; a refused batch is counted", async () => {
    const { fake } = setup();
    const items = Array.from({ length: 60 }, (_, index) => ({
      memberId: `m${String(index)}`,
      level: 3,
    }));
    fake.respond("setMemberLevels", apiErr(FORBIDDEN));
    const outcome = await confirmAll(fake.api, GROUP, items);
    expect(fake.calls().map((call) => (call.args[1] as readonly unknown[]).length)).toEqual([
      50, 10,
    ]);
    expect(outcome.failed).toBe(60);
    expect(outcome.sent).toEqual([]);
  });

  test("Confirmar todas that went through sends every card once", async () => {
    const { fake, client, deps } = setup();
    client.setQueryData(queryKeys.memberLevels(GROUP), LEVELS);
    fake.respond("setMemberLevels", apiOk([]));
    const outcome = await new MutationObserver(client, confirmAllMutation(deps, GROUP)).mutate([
      { memberId: "b", level: 4 },
      { memberId: "l", level: null },
    ]);
    expect(outcome).toEqual({ sent: ["b", "l"], failed: 0, error: null });
    expect(isStale(client, queryKeys.memberLevels(GROUP))).toBe(true);
  });
});

describe("Remover do grupo (question 30)", () => {
  test("removes by MemberId and reads the members and the levels again", async () => {
    const fake = createFakeSacouApi();
    const client = createSacouQueryClient();
    const store = createMemoryInviteLinkStore({});
    client.setQueryData(queryKeys.members(GROUP), []);
    client.setQueryData(queryKeys.memberLevels(GROUP), LEVELS);
    fake.respond("removeMember", apiOk(null));
    const target = member("b", "player");
    await new MutationObserver(
      client,
      removeMemberMutation({ api: fake.api, client, store }, GROUP),
    ).mutate(target);
    expect(fake.calls()).toEqual([
      { operation: "removeMember", args: [{ groupId: GROUP, memberId: "b" }] },
    ]);
    expect(isStale(client, queryKeys.members(GROUP))).toBe(true);
    expect(isStale(client, queryKeys.memberLevels(GROUP))).toBe(true);
  });
});
