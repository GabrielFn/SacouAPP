import { MutationObserver } from "@tanstack/react-query";
import { persistQueryClientSave } from "@tanstack/react-query-persist-client";
import { describe, expect, test } from "vitest";

import { createFakeSacouApi } from "../../../adapters/fake-sacou-api";
import { createMemoryKeyValueStore } from "../../../adapters/memory-key-value-store";
import { errorTextOf } from "../../../services/api/api-error-text";
import { apiErr, apiOk } from "../../../services/api/api-result";
import type { MyProfile, SaveMyProfileBody } from "../../../services/api/sacou-api";
import {
  CACHE_STORAGE_KEY,
  createCachePersister,
  persistOptions,
} from "../../../services/query/cache-persister";
import { createSacouQueryClient } from "../../../services/query/query-client";
import { queryKeys } from "../../../services/query/query-keys";
import { apiErrorKindTexts } from "../../../strings/api-errors.pt-BR";
import { myProfileQuery, saveProfileMutation } from "./profile-queries";

const G1 = "8a4c2f0e-1111-4c3b-9d2e-0000000000a1";
const G2 = "8a4c2f0e-1111-4c3b-9d2e-0000000000a2";
/** A suggestion nobody else would have: the marker searched in the persisted file. */
const PLANTED_LEVEL = 3.5;
const PROFILE: MyProfile = {
  nickname: "João",
  primaryPosition: "outsideHitter",
  otherPositions: ["opposite"],
  suggestedLevel: PLANTED_LEVEL,
};
const BODY: SaveMyProfileBody = {
  nickname: "João",
  primaryPosition: "outsideHitter",
  otherPositions: ["opposite"],
  suggestedLevel: 4,
};

describe("the profile query", () => {
  test("404 profile-not-found is 'never saved' (null), not a failure", async () => {
    const fake = createFakeSacouApi();
    fake.respond(
      "getMyProfile",
      apiErr({ kind: "problem", status: 404, code: "identity.profile-not-found" }),
    );
    const client = createSacouQueryClient();
    expect(await client.query(myProfileQuery(fake.api, true, client))).toBeNull();
  });

  test("any other error is a failure", async () => {
    const fake = createFakeSacouApi();
    fake.respond("getMyProfile", apiErr({ kind: "unavailable", retryAfterMs: 0 }));
    const client = createSacouQueryClient();
    await expect(
      client.query({ ...myProfileQuery(fake.api, true, client), retry: false }),
    ).rejects.toThrow();
  });

  test("keeps only the nickname on disk, for the greeting without a network", async () => {
    const fake = createFakeSacouApi();
    fake.respond("getMyProfile", apiOk(PROFILE));
    const client = createSacouQueryClient();
    await client.query(myProfileQuery(fake.api, true, client));
    expect(client.getQueryData(queryKeys.myNickname())).toBe(PROFILE.nickname);
    const store = createMemoryKeyValueStore();
    await persistQueryClientSave({
      queryClient: client,
      ...persistOptions(createCachePersister(store, 0), "1.0.0"),
    });
    const file = store.entries().get(CACHE_STORAGE_KEY) ?? "";
    expect(file).toContain(PROFILE.nickname);
    expect(file).not.toContain(String(PLANTED_LEVEL));
  });

  test("the profile (with its level) is never written to sacou-cache.db, with or without the groups", async () => {
    const fake = createFakeSacouApi();
    fake.respond("getMyProfile", apiOk(PROFILE));
    const client = createSacouQueryClient();
    await client.query(myProfileQuery(fake.api, true, client));
    client.setQueryData(queryKeys.groups(), [{ groupId: G1 }]);
    const store = createMemoryKeyValueStore();
    await persistQueryClientSave({
      queryClient: client,
      ...persistOptions(createCachePersister(store, 0), "1.0.0"),
    });
    const file = store.entries().get(CACHE_STORAGE_KEY) ?? "";
    expect(file).toContain(G1);
    expect(file).not.toContain(String(PLANTED_LEVEL));
    expect(file).not.toContain('"profile"');
  });
});

describe("saving the profile", () => {
  function harness() {
    const fake = createFakeSacouApi();
    const client = createSacouQueryClient();
    const observer = new MutationObserver(client, saveProfileMutation({ api: fake.api, client }));
    return { fake, client, observer };
  }

  test("writes the answer and makes the members of the cached groups stale", async () => {
    const { fake, client, observer } = harness();
    fake.respond("saveMyProfile", apiOk(PROFILE));
    client.setQueryData(queryKeys.groups(), [{ groupId: G1 }, { groupId: G2 }]);
    client.setQueryData(queryKeys.members(G1), []);
    client.setQueryData(queryKeys.members(G2), []);
    client.setQueryData(queryKeys.group(G2), { groupId: G2 });

    await observer.mutate(BODY);

    expect(fake.calls()).toEqual([{ operation: "saveMyProfile", args: [BODY] }]);
    expect(client.getQueryData(queryKeys.myProfile())).toEqual(PROFILE);
    expect(client.getQueryState(queryKeys.members(G1))?.isInvalidated).toBe(true);
    expect(client.getQueryState(queryKeys.members(G2))?.isInvalidated).toBe(true);
    expect(client.getQueryState(queryKeys.groups())?.isInvalidated).toBe(false);
  });

  test.each([
    ["the nickname refused by the server", "identity.nickname-invalid"],
    ["the positions or the level refused", "identity.profile-invalid"],
  ] as const)("%s has its text and writes nothing", async (_name, code) => {
    const { fake, client, observer } = harness();
    fake.respond("saveMyProfile", apiErr({ kind: "problem", status: 400, code }));
    const error = await observer.mutate(BODY).catch((failure: unknown) => failure);
    expect(errorTextOf(error)).toBe(
      code === "identity.nickname-invalid"
        ? "Escolha um apelido de até 20 letras, sem deixar em branco."
        : "Confira as posições e o nível escolhidos e tente de novo.",
    );
    expect(client.getQueryData(queryKeys.myProfile())).toBeUndefined();
  });

  test("offline has its text and writes nothing", async () => {
    const { fake, client, observer } = harness();
    fake.respond("saveMyProfile", apiErr({ kind: "offline" }));
    const error = await observer.mutate(BODY).catch((failure: unknown) => failure);
    expect(errorTextOf(error)).toBe(apiErrorKindTexts.offline);
    expect(client.getQueryCache().getAll()).toEqual([]);
  });
});
