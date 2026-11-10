import {
  MutationObserver,
  onlineManager,
  QueryObserver,
  type QueryClient,
} from "@tanstack/react-query";
import {
  persistQueryClientRestore,
  persistQueryClientSave,
} from "@tanstack/react-query-persist-client";
import { afterEach, describe, expect, test, vi } from "vitest";

import { createFakeNetworkStatus } from "../../adapters/fake-network-status";
import { createFakeSacouApi, type FakeSacouApi } from "../../adapters/fake-sacou-api";
import { FAKE_ID_TOKEN } from "../../adapters/fake-id-token-provider";
import {
  createMemoryKeyValueStore,
  type MemoryKeyValueStore,
} from "../../adapters/memory-key-value-store";
import {
  groupMembersQuery,
  groupQuery,
  myGroupsQuery,
} from "../../features/groups/queries/group-queries";
import { apiErrorOf } from "../api/api-error";
import { apiErr, apiOk, unwrap } from "../api/api-result";
import type { Group, Member, MyGroup } from "../api/sacou-api";
import {
  CACHE_STORAGE_KEY,
  createCachePersister,
  createCacheSession,
  persistOptions,
} from "./cache-persister";
import { PERSISTED_CACHE_MAX_AGE_MS } from "./persist-policy";
import { bindOnlineManager, createSacouQueryClient } from "./query-client";
import { queryKeys } from "./query-keys";

const G = "8a4c2f0e-1111-4c3b-9d2e-000000000001";
const VERSION = "1.0.0";
const USER_ID = "user-id-Kp3";
const INVITE_TOKEN = "invite-token-Qw7";
const myGroup: MyGroup = {
  groupId: G,
  name: "Racha da Quinta",
  role: "admin",
  memberType: "regular",
};
const group: Group = { ...myGroup, memberId: "m1", activeMembers: 12 };
const member: Member = {
  memberId: "m1",
  role: "admin",
  memberType: "regular",
  hasAccount: true,
  isMe: true,
  joinedAt: "2026-11-01T10:00:00Z",
};

function programmed(): FakeSacouApi {
  const fake = createFakeSacouApi();
  fake.respond("listMyGroups", apiOk([myGroup]));
  fake.respond("getGroup", apiOk(group));
  fake.respond("listMembers", apiOk([member]));
  fake.respond("signIn", apiOk({ userId: USER_ID }));
  fake.respond("listInvites", apiOk([]));
  fake.respond("createInvite", apiOk({ inviteId: "i1", token: INVITE_TOKEN, expiresAt: null }));
  return fake;
}

const persister = (store: MemoryKeyValueStore) => createCachePersister(store, 0);

async function save(client: QueryClient, store: MemoryKeyValueStore, version = VERSION) {
  await persistQueryClientSave({
    queryClient: client,
    ...persistOptions(persister(store), version),
  });
}

async function restore(store: MemoryKeyValueStore, version = VERSION): Promise<QueryClient> {
  const client = createSacouQueryClient();
  await persistQueryClientRestore({
    queryClient: client,
    ...persistOptions(persister(store), version),
  });
  return client;
}

async function loadAll(client: QueryClient, fake: FakeSacouApi): Promise<void> {
  await client.query(myGroupsQuery(fake.api));
  await client.query(groupQuery(fake.api, G));
  await client.query(groupMembersQuery(fake.api, G));
  await client.query({
    queryKey: queryKeys.me(),
    queryFn: () => unwrap(fake.api.signIn()),
  });
  await client.query({
    queryKey: queryKeys.invites(G),
    queryFn: () => unwrap(fake.api.listInvites(G)),
  });
}

function stored(store: MemoryKeyValueStore): string {
  return store.entries().get(CACHE_STORAGE_KEY) ?? "";
}

function persistedKeys(store: MemoryKeyValueStore): readonly string[] {
  const parsed = JSON.parse(stored(store)) as {
    clientState: { queries: readonly { queryKey: readonly unknown[] }[] };
  };
  return parsed.clientState.queries.map(({ queryKey }) => JSON.stringify(queryKey));
}

afterEach(() => {
  onlineManager.setOnline(true);
  vi.useRealTimers();
});

describe("persist and restore (Q2, Q5)", () => {
  test("the three allowed keys come back, and nothing else", async () => {
    const store = createMemoryKeyValueStore();
    const client = createSacouQueryClient();
    await loadAll(client, programmed());
    await save(client, store);

    const restored = await restore(store);

    expect(restored.getQueryData(queryKeys.groups())).toEqual([myGroup]);
    expect(restored.getQueryData(queryKeys.group(G))).toEqual(group);
    expect(restored.getQueryData(queryKeys.members(G))).toEqual([member]);
    expect(restored.getQueryData(queryKeys.me())).toBeUndefined();
    expect(restored.getQueryData(queryKeys.invites(G))).toBeUndefined();
  });

  test("the written cache has no token, no userId and no invite token", async () => {
    const store = createMemoryKeyValueStore();
    const client = createSacouQueryClient();
    const fake = programmed();
    await loadAll(client, fake);
    const invite = new MutationObserver(client, {
      mutationFn: () => unwrap(fake.api.createInvite(G)),
    });
    await invite.mutate();
    await save(client, store);

    const text = stored(store);
    expect(text).toContain("Racha da Quinta");
    [FAKE_ID_TOKEN, USER_ID, INVITE_TOKEN].forEach((secret) => {
      expect(text).not.toContain(secret);
    });
  });

  test("another buster drops everything", async () => {
    const store = createMemoryKeyValueStore();
    const client = createSacouQueryClient();
    await loadAll(client, programmed());
    await save(client, store, "1.0.0");

    const restored = await restore(store, "1.0.1");

    expect(restored.getQueryCache().getAll()).toHaveLength(0);
  });

  test("a cache older than seven days is dropped", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse("2026-11-01T12:00:00Z"));
    const store = createMemoryKeyValueStore();
    const client = createSacouQueryClient();
    await loadAll(client, programmed());
    await save(client, store);

    vi.setSystemTime(Date.parse("2026-11-01T12:00:00Z") + PERSISTED_CACHE_MAX_AGE_MS - 1);
    expect((await restore(store)).getQueryData(queryKeys.groups())).toEqual([myGroup]);
    vi.setSystemTime(Date.parse("2026-11-01T12:00:00Z") + PERSISTED_CACHE_MAX_AGE_MS + 1);
    expect((await restore(store)).getQueryData(queryKeys.groups())).toBeUndefined();
  });
});

describe("offline (Q1, Q6)", () => {
  test("offline, the kept list shows without an error, and comes again with the network", async () => {
    const store = createMemoryKeyValueStore();
    const first = createSacouQueryClient();
    const fake = programmed();
    await first.query(myGroupsQuery(fake.api));
    await save(first, store);
    const network = createFakeNetworkStatus(false);
    const unbind = bindOnlineManager(network);
    const client = await restore(store);
    // The provider mounts the client in the app: that is how it hears the network.
    client.mount();
    const callsBefore = fake.calls().length;

    const observer = new QueryObserver(client, { ...myGroupsQuery(fake.api), staleTime: 0 });
    const stop = observer.subscribe(() => undefined);

    expect(observer.getCurrentResult()).toMatchObject({ status: "success", data: [myGroup] });
    expect(fake.calls()).toHaveLength(callsBefore);
    network.set(true);
    await vi.waitFor(() => {
      expect(fake.calls().length).toBeGreaterThan(callsBefore);
    });
    stop();
    unbind();
    client.unmount();
  });

  test("a mutation offline fails at once instead of waiting for the network", async () => {
    onlineManager.setOnline(false);
    const client = createSacouQueryClient();
    const fake = createFakeSacouApi();
    fake.respond("createGroup", apiErr({ kind: "offline" }));
    const observer = new MutationObserver(client, {
      mutationFn: (name: string) => unwrap(fake.api.createGroup(name)),
    });

    const error: unknown = await observer.mutate("Racha").catch((thrown: unknown) => thrown);

    expect(apiErrorOf(error)).toEqual({ kind: "offline" });
    expect(fake.calls()).toHaveLength(1);
  });
});

describe("the cache follows the server (Q3, Q4, H6)", () => {
  test("a group that is gone leaves the cache and the next write", async () => {
    const store = createMemoryKeyValueStore();
    const client = createSacouQueryClient();
    const fake = programmed();
    await loadAll(client, fake);
    fake.respond(
      "listMembers",
      apiErr({ kind: "problem", status: 404, code: "groups.group-not-found" }),
    );

    await client.query({ ...groupMembersQuery(fake.api, G), staleTime: 0 }).catch(() => undefined);
    await save(client, store);

    expect(client.getQueryData(queryKeys.group(G))).toBeUndefined();
    expect(client.getQueryData(queryKeys.members(G))).toBeUndefined();
    expect(client.getQueryState(queryKeys.groups())?.isInvalidated).toBe(true);
    expect(persistedKeys(store)).toEqual([JSON.stringify(queryKeys.groups())]);
  });

  test("clearSession empties memory and the store", async () => {
    const store = createMemoryKeyValueStore();
    const client = createSacouQueryClient();
    await loadAll(client, programmed());
    await save(client, store);

    await createCacheSession(client, persister(store)).clearSession();
    await save(client, store);

    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(store.entries().size).toBe(0);
  });

  test("the invite token leaves memory once no screen holds the mutation", async () => {
    const client = createSacouQueryClient();
    const fake = programmed();
    const observer = new MutationObserver(client, {
      mutationFn: () => unwrap(fake.api.createInvite(G)),
    });

    const created = await observer.mutate();
    expect(created.token).toBe(INVITE_TOKEN);
    observer.reset();

    await vi.waitFor(() => {
      expect(client.getMutationCache().getAll()).toHaveLength(0);
    });
    expect(
      JSON.stringify(
        client
          .getQueryCache()
          .getAll()
          .map((query) => query.state),
      ),
    ).not.toContain(INVITE_TOKEN);
  });
});
