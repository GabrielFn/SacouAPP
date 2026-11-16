import { beforeEach, describe, expect, test, vi } from "vitest";

import { INVITE_INDEX_KEY, inviteKeyOf } from "./invite-link-codec";
import { secureStoreInviteLinkStore } from "./secure-store-invite-link-store";

const store = vi.hoisted(() => ({
  items: new Map<string, string>(),
  writes: [] as string[],
  failingDeletes: new Set<string>(),
  failingWrites: new Set<string>(),
}));

vi.mock("expo-secure-store", () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 6,
  getItemAsync: (key: string) => Promise.resolve(store.items.get(key) ?? null),
  setItemAsync: (key: string, value: string) => {
    if (store.failingWrites.has(key)) return Promise.reject(new Error("store locked"));
    store.writes.push(key);
    store.items.set(key, value);
    return Promise.resolve();
  },
  deleteItemAsync: (key: string) => {
    if (store.failingDeletes.has(key)) return Promise.reject(new Error("store locked"));
    store.items.delete(key);
    return Promise.resolve();
  },
}));

const GROUP_A = "group-a";
const GROUP_B = "group-b";
const LINK = { inviteId: "invite-1", token: "secret-token" };

function keyOf(groupId: string): string {
  const key = inviteKeyOf(groupId);
  if (key === null) throw new Error("unsafe test id");
  return key;
}

describe("secureStoreInviteLinkStore", () => {
  beforeEach(() => {
    store.items.clear();
    store.writes = [];
    store.failingDeletes.clear();
    store.failingWrites.clear();
  });

  test("save writes the index before the token, so clearAll always knows of the key", async () => {
    await secureStoreInviteLinkStore.save(GROUP_A, LINK);
    expect(store.writes).toEqual([INVITE_INDEX_KEY, keyOf(GROUP_A)]);
  });

  test("a save that fails after the index leaves no token behind for clearAll to miss", async () => {
    store.failingWrites.add(keyOf(GROUP_A));
    await expect(secureStoreInviteLinkStore.save(GROUP_A, LINK)).rejects.toThrow();
    expect(store.items.has(keyOf(GROUP_A))).toBe(false);
    expect(store.items.get(INVITE_INDEX_KEY)).toBe(JSON.stringify([GROUP_A]));
  });

  test("clearAll tries every key and does not reject when one of them fails", async () => {
    await secureStoreInviteLinkStore.save(GROUP_A, LINK);
    await secureStoreInviteLinkStore.save(GROUP_B, LINK);
    store.failingDeletes.add(keyOf(GROUP_A));

    await expect(secureStoreInviteLinkStore.clearAll()).resolves.toBeUndefined();

    expect(store.items.has(keyOf(GROUP_B))).toBe(false);
    expect(store.items.get(INVITE_INDEX_KEY)).toBe(JSON.stringify([GROUP_A]));
  });

  test("clearAll forgets every key and the index when nothing fails", async () => {
    await secureStoreInviteLinkStore.save(GROUP_A, LINK);
    await secureStoreInviteLinkStore.save(GROUP_B, LINK);

    await secureStoreInviteLinkStore.clearAll();

    expect(store.items.size).toBe(0);
  });

  test("clearAll does not reject when the index itself cannot be deleted", async () => {
    await secureStoreInviteLinkStore.save(GROUP_A, LINK);
    store.failingDeletes.add(INVITE_INDEX_KEY);

    await expect(secureStoreInviteLinkStore.clearAll()).resolves.toBeUndefined();
    expect(store.items.has(keyOf(GROUP_A))).toBe(false);
  });
});
