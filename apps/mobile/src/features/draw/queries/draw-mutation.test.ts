import { MutationObserver, QueryClient } from "@tanstack/react-query";
import { describe, expect, test, vi } from "vitest";

import { createFakeSacouApi } from "../../../adapters/fake-sacou-api";
import { apiErr, apiOk } from "../../../services/api/api-result";
import type { DrawTeamsAnswer } from "../../../services/api/sacou-api";
import { shouldPersistQuery } from "../../../services/query/persist-policy";
import { createSacouQueryClient } from "../../../services/query/query-client";
import { queryKeys } from "../../../services/query/query-keys";
import { G1_ANSWER, g1Round } from "../model/draw.test.fixture";
import { drawMutation, drawRefusedEffects, drawScope } from "./draw-mutation";

const GROUP = "g1";
const ROUND = "r1";

function setup() {
  const fake = createFakeSacouApi();
  const client = createSacouQueryClient();
  client.setQueryData(queryKeys.round(GROUP, ROUND), g1Round());
  const observer = new MutationObserver(client, drawMutation(fake.api, client, GROUP, ROUND));
  return { fake, client, observer };
}

function everythingIn(client: QueryClient): string {
  const queries = client
    .getQueryCache()
    .getAll()
    .map((query) => [query.queryKey, query.state]);
  const mutations = client
    .getMutationCache()
    .getAll()
    .map((mutation) => mutation.state);
  return JSON.stringify({ queries, mutations });
}

describe("the draw mutation keeps the levels out of every cache (ADR 0060)", () => {
  test("the answer goes only to deliver; the mutation keeps null", async () => {
    const { fake, client, observer } = setup();
    fake.respond("drawTeams", apiOk(G1_ANSWER));
    const delivered: DrawTeamsAnswer[] = [];
    await observer.mutate({ body: {}, deliver: (answer) => delivered.push(answer) });
    expect(delivered).toEqual([G1_ANSWER]);
    expect(observer.getCurrentResult().data).toBeNull();
    expect(everythingIn(client)).not.toContain("levelTenths");
    expect(fake.calls()).toEqual([{ operation: "drawTeams", args: [GROUP, ROUND, {}] }]);
  });

  test("nothing of the draw is persisted, and the mutation leaves memory when unused", async () => {
    vi.useFakeTimers();
    try {
      const { fake, client, observer } = setup();
      fake.respond("drawTeams", apiOk(G1_ANSWER));
      const unsubscribe = observer.subscribe(() => undefined);
      await observer.mutate({ body: {}, deliver: () => undefined });
      const persisted = client.getQueryCache().getAll().filter(shouldPersistQuery);
      expect(JSON.stringify(persisted.map((query) => query.state))).not.toContain("levelTenths");
      unsubscribe();
      observer.reset();
      await vi.runAllTimersAsync();
      expect(client.getMutationCache().getAll()).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  test("one draw at a time per round, never kept", () => {
    const { fake, client } = setup();
    const options = drawMutation(fake.api, client, GROUP, ROUND);
    expect(options.scope).toEqual(drawScope(ROUND));
    expect(options.scope.id).toBe("draw:r1");
    expect(options.gcTime).toBe(0);
  });

  test("a refusal reaches the observer as the error, and delivers nothing", async () => {
    const { fake, observer } = setup();
    fake.respond(
      "drawTeams",
      apiErr({ kind: "problem", status: 400, code: "sessions.draw-locks-unsatisfiable" }),
    );
    const deliver = vi.fn();
    await expect(observer.mutate({ body: {}, deliver })).rejects.toThrow();
    expect(deliver).not.toHaveBeenCalled();
  });
});

describe("what a refused draw makes stale (D1, D2)", () => {
  test("what is not a failure of the API makes nothing stale", () => {
    expect(drawRefusedEffects(GROUP, ROUND, new Error("boom"))).toEqual([]);
  });

  test.each([
    [403, "groups.forbidden", true],
    [409, "sessions.round-closed", false],
    [400, "sessions.draw-reserves-invalid", false],
  ] as const)("a %s %s invalidates the round (and the group: %s)", async (status, code, group) => {
    const { fake, client, observer } = setup();
    fake.respond("drawTeams", apiErr({ kind: "problem", status, code }));
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await observer.mutate({ body: {}, deliver: () => undefined }).catch(() => undefined);
    const keys = invalidate.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey));
    expect(keys).toContain(JSON.stringify(queryKeys.round(GROUP, ROUND)));
    expect(keys.includes(JSON.stringify(queryKeys.group(GROUP)))).toBe(group);
  });

  test("no network invalidates nothing", async () => {
    const { fake, client, observer } = setup();
    fake.respond("drawTeams", apiErr({ kind: "offline" }));
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await observer.mutate({ body: {}, deliver: () => undefined }).catch(() => undefined);
    expect(invalidate).not.toHaveBeenCalled();
  });
});
