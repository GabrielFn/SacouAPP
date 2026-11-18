import {
  persistQueryClientRestore,
  persistQueryClientSave,
} from "@tanstack/react-query-persist-client";
import { describe, expect, test } from "vitest";

import { createMemoryKeyValueStore } from "../../adapters/memory-key-value-store";
import { greetingNicknameOf, isProfileStub } from "../../features/profile/model/profile-stub";
import { CACHE_STORAGE_KEY, createCachePersister, persistOptions } from "./cache-persister";
import { createSacouQueryClient } from "./query-client";
import { queryKeys } from "./query-keys";

const VERSION = "1.0.0";
const FULL = {
  nickname: "Ana",
  primaryPosition: "setter",
  otherPositions: ["libero"],
  suggestedLevel: 4.5,
};

interface Row {
  clientState: {
    queries: { queryKey: unknown[]; state: { data: unknown; dataUpdatedAt: number } }[];
  };
}

async function saveWith(data: unknown) {
  const store = createMemoryKeyValueStore();
  const client = createSacouQueryClient();
  client.setQueryData(queryKeys.myProfile(), data);
  const persister = createCachePersister(store, 0);
  await persistQueryClientSave({ queryClient: client, ...persistOptions(persister, VERSION) });
  return { store, persister, raw: store.entries().get(CACHE_STORAGE_KEY) ?? "" };
}

describe("the nickname on disk (ADR 0057, D9)", () => {
  test("only { nickname } is written, as a stale record under one key", async () => {
    const { raw } = await saveWith(FULL);
    const row = JSON.parse(raw) as Row;
    expect(row.clientState.queries).toHaveLength(1);
    const [query] = row.clientState.queries;
    expect(query?.queryKey).toEqual(["me", "profile"]);
    expect(query?.state.data).toEqual({ nickname: "Ana" });
    expect(query?.state.dataUpdatedAt).toBe(0);
    expect(raw).not.toContain("libero");
    expect(raw).not.toContain("4.5");
    expect(raw).not.toContain("setter");
  });

  test("the live record in memory is not mutated by saving", async () => {
    const client = createSacouQueryClient();
    client.setQueryData(queryKeys.myProfile(), FULL);
    const persister = createCachePersister(createMemoryKeyValueStore(), 0);
    await persistQueryClientSave({ queryClient: client, ...persistOptions(persister, VERSION) });
    expect(client.getQueryData(queryKeys.myProfile())).toEqual(FULL);
    expect(client.getQueryState(queryKeys.myProfile())?.dataUpdatedAt).toBeGreaterThan(0);
  });

  test.each([
    ["never saved (null)", null],
    ["no nickname", { suggestedLevel: 3 }],
    ["a non-string nickname", { nickname: 7 }],
  ])("%s: nothing of the profile is persisted", async (_name, data) => {
    const { store, raw } = await saveWith(data);
    expect(raw).not.toContain("profile");
    expect(raw).not.toContain("suggestedLevel");
    expect(store.entries().get(CACHE_STORAGE_KEY) ?? "").not.toContain('"me"');
  });

  test("a restored copy is a stub that still serves the greeting", async () => {
    const { store, persister } = await saveWith(FULL);
    const client = createSacouQueryClient();
    await persistQueryClientRestore({ queryClient: client, ...persistOptions(persister, VERSION) });
    const data = client.getQueryData<{ nickname: string }>(queryKeys.myProfile());
    expect(data).toEqual({ nickname: "Ana" });
    expect(isProfileStub(data as never)).toBe(true);
    expect(greetingNicknameOf(data as never)).toBe("Ana");
    expect(client.getQueryState(queryKeys.myProfile())?.dataUpdatedAt).toBe(0);
    expect(store.entries().has(CACHE_STORAGE_KEY)).toBe(true);
  });
});
