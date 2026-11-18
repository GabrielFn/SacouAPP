import { QueryObserver } from "@tanstack/react-query";
import { persistQueryClientSave } from "@tanstack/react-query-persist-client";
import { describe, expect, test } from "vitest";

import {
  createFakeAuthSession,
  fakeSessionIdentity,
  type FakeAuthSession,
} from "../../adapters/fake-auth-session";
import { createFakeHttpTransport, jsonAnswer } from "../../adapters/fake-http-transport";
import { createHttpSacouApi } from "../../adapters/http-sacou-api";
import { createMemoryInviteLinkStore } from "../../adapters/memory-invite-link-store";
import { createMemoryKeyValueStore } from "../../adapters/memory-key-value-store";
import {
  createStoredOnboardingSkip,
  ONBOARDING_SKIP_KEY,
} from "../../adapters/stored-onboarding-skip";
import { strings } from "../../strings/pt-BR";
import type { SessionIdentity, SessionSnapshot } from "../auth/auth-session";
import { signOutReasonText } from "../../features/auth/model/auth-failure-text";
import {
  CACHE_STORAGE_KEY,
  createCachePersister,
  createCacheSession,
  persistOptions,
} from "../query/cache-persister";
import { createSacouQueryClient } from "../query/query-client";
import { queryKeys } from "../query/query-keys";
import { createSessionEnder, sessionIdTokens } from "./end-session";

const BASE = "https://api.example";
/** Three calls, each refused before and after the renewal. */
const CALLS = 3;
const REFUSALS = CALLS + CALLS;
const VERSION = "1.0.0";
const GROUP_A = "8a4c2f0e-1111-4c3b-9d2e-0000000000aa";
const SIGNED_IN = {
  status: "signedIn",
  account: { provider: "google", email: "a@x.com", displayName: "Ana" },
} as const;

const SIGNED_IN_B = {
  status: "signedIn",
  account: { provider: "password", email: "b@x.com", displayName: "Bia" },
} as const;

function sessionOf(auth: FakeAuthSession): SessionIdentity {
  const session = auth.currentSession();
  if (session === null) throw new Error("nobody signed in");
  return session;
}

function setup(initial: SessionSnapshot = SIGNED_IN) {
  const order: string[] = [];
  const auth = createFakeAuthSession({
    initial,
    onCall: (call) => {
      if (call.method !== "getIdToken") order.push(call.method);
    },
  });
  const client = createSacouQueryClient();
  const store = createMemoryKeyValueStore();
  const persister = createCachePersister(store, 0);
  const cacheSession = createCacheSession(client, persister);
  const inviteLinkStore = createMemoryInviteLinkStore();
  const onboardingSkip = createStoredOnboardingSkip(store);
  const queries = {
    cancelQueries: async () => {
      order.push("cancelQueries");
      await client.cancelQueries();
    },
  };
  const stores = {
    cacheSession: {
      clearSession: async () => {
        order.push("clearSession");
        await cacheSession.clearSession();
      },
    },
    inviteLinkStore,
    onboardingSkip,
  };
  const ender = createSessionEnder({ authSession: auth, queries, stores });
  return { auth, client, store, persister, inviteLinkStore, onboardingSkip, ender, order };
}

function callsOf(auth: FakeAuthSession): string[] {
  return auth
    .calls()
    .map((call) => call.method)
    .filter((method) => method !== "getIdToken");
}

function signOutCount(harness: { readonly auth: FakeAuthSession }): number {
  return harness.auth.calls().filter((call) => call.method === "signOut").length;
}

describe("endSession", () => {
  test("signs out first, then cancels, clears and forgets the Google account, in this order", async () => {
    const harness = setup();
    await harness.ender.end("signedOut");
    expect(harness.order).toEqual([
      "signOut",
      "cancelQueries",
      "clearSession",
      "forgetProviderAccount",
    ]);
    expect(harness.auth.snapshot()).toEqual({ status: "signedOut", reason: "signedOut" });
  });

  test("the invite links and the cache file are empty afterwards", async () => {
    const harness = setup();
    await harness.inviteLinkStore.save(GROUP_A, { inviteId: "i1", token: "invite-token-Qw7" });
    harness.client.setQueryData(queryKeys.groups(), [{ groupId: GROUP_A }]);
    await persistQueryClientSave({
      queryClient: harness.client,
      ...persistOptions(harness.persister, VERSION),
    });
    expect(harness.store.entries().has(CACHE_STORAGE_KEY)).toBe(true);
    await harness.ender.end("signedOut");
    expect(await harness.inviteLinkStore.read(GROUP_A)).toBeNull();
    expect(harness.store.entries().has(CACHE_STORAGE_KEY)).toBe(false);
    expect(harness.client.getQueryCache().getAll()).toEqual([]);
  });

  test("the skip of the quick profile and the profile itself are forgotten", async () => {
    const harness = setup();
    await harness.onboardingSkip.markSkipped();
    harness.client.setQueryData(queryKeys.myProfile(), { nickname: "Ana", suggestedLevel: 4 });
    expect(harness.store.entries().get(ONBOARDING_SKIP_KEY)).toBe("1");
    await harness.ender.end("signedOut");
    expect(harness.store.entries().has(ONBOARDING_SKIP_KEY)).toBe(false);
    expect(harness.onboardingSkip.snapshot()).toBe("notSkipped");
    expect(harness.client.getQueryData(queryKeys.myProfile())).toBeUndefined();
  });

  test("clearSession removes the nickname from memory and from sacou-cache.db", async () => {
    const harness = setup();
    harness.client.setQueryData(queryKeys.myProfile(), { nickname: "Ana", suggestedLevel: 4 });
    await persistQueryClientSave({
      queryClient: harness.client,
      ...persistOptions(harness.persister, VERSION),
    });
    expect(harness.store.entries().get(CACHE_STORAGE_KEY)).toContain("Ana");
    await harness.ender.end("signedOut");
    expect(harness.store.entries().has(CACHE_STORAGE_KEY)).toBe(false);
    expect(harness.client.getQueryData(queryKeys.myProfile())).toBeUndefined();
  });

  test("a query in flight during the exit does not write the cache again", async () => {
    const harness = setup();
    const answer: { current: (groups: unknown) => void } = { current: () => undefined };
    const observer = new QueryObserver(harness.client, {
      queryKey: queryKeys.groups(),
      queryFn: () =>
        new Promise((resolve) => {
          answer.current = resolve;
        }),
    });
    const unsubscribe = observer.subscribe(() => undefined);
    await harness.ender.end("signedOut");
    answer.current([{ groupId: GROUP_A }]);
    await Promise.resolve();
    expect(harness.client.getQueryData(queryKeys.groups())).toBeUndefined();
    unsubscribe();
  });

  test("calls at the same time end the session once", async () => {
    const harness = setup();
    await Promise.all([
      harness.ender.end("expired"),
      harness.ender.end("expired"),
      harness.ender.end("signedOut"),
    ]);
    await harness.ender.end("expired");
    expect(signOutCount(harness)).toBe(1);
    expect(harness.auth.snapshot()).toEqual({ status: "signedOut", reason: "expired" });
  });

  test("the app opening signed out clears the old cache once", async () => {
    const harness = setup({ status: "signedOut", reason: null });
    harness.client.setQueryData(queryKeys.groups(), [{ groupId: GROUP_A }]);
    await Promise.all([harness.ender.cleanUp(), harness.ender.cleanUp()]);
    await harness.ender.cleanUp();
    expect(harness.client.getQueryData(queryKeys.groups())).toBeUndefined();
    expect(callsOf(harness.auth)).toEqual(["forgetProviderAccount"]);
    expect(signOutCount(harness)).toBe(0);
  });

  test("account switch: B starts with nothing of A, in memory or on disk", async () => {
    const harness = setup();
    harness.client.setQueryData(queryKeys.groups(), [{ groupId: GROUP_A, name: "Racha de A" }]);
    await persistQueryClientSave({
      queryClient: harness.client,
      ...persistOptions(harness.persister, VERSION),
    });
    await harness.ender.end("signedOut");
    harness.auth.emit({
      status: "signedIn",
      account: { provider: "password", email: "b@x.com", displayName: null },
    });
    expect(harness.client.getQueryCache().getAll()).toEqual([]);
    expect(JSON.stringify([...harness.store.entries()])).not.toContain(GROUP_A);
    // A later sign-out of B cleans again: the "already clean" mark belongs to one signed-out period.
    harness.client.setQueryData(queryKeys.groups(), [{ groupId: "b" }]);
    await harness.ender.end("signedOut");
    expect(harness.client.getQueryData(queryKeys.groups())).toBeUndefined();
  });
});

describe("the API client and the session", () => {
  function api(harness: ReturnType<typeof setup>) {
    const http = createFakeHttpTransport();
    const client = createHttpSacouApi({
      baseUrl: BASE,
      transport: http.transport,
      idTokens: sessionIdTokens(harness.auth, harness.ender),
      now: () => 0,
      timeoutMs: 20,
    });
    return { client, http };
  }

  const unauthorized = () => jsonAnswer(401, { title: "x", status: 401 });

  test("signed out, nothing is sent", async () => {
    const harness = setup({ status: "signedOut", reason: null });
    const { client, http } = api(harness);
    const result = await client.listMyGroups();
    expect(result.ok).toBe(false);
    expect(http.requests()).toHaveLength(0);
    expect(signOutCount(harness)).toBe(0);
  });

  test("forceRefresh reaches the session after a 401", async () => {
    const harness = setup();
    const { client, http } = api(harness);
    http.enqueue(unauthorized(), jsonAnswer(200, []));
    await client.listMyGroups();
    const tokenCalls = harness.auth.calls().filter((call) => call.method === "getIdToken");
    expect(tokenCalls).toEqual([
      { method: "getIdToken", forceRefresh: false },
      { method: "getIdToken", forceRefresh: true },
    ]);
  });

  test("three calls refused twice end the session once, with the expired line", async () => {
    const harness = setup();
    const { client, http } = api(harness);
    http.enqueue(...Array.from({ length: REFUSALS }, unauthorized));
    await Promise.all([client.listMyGroups(), client.listMyGroups(), client.listMyGroups()]);
    await harness.ender.end("expired");
    expect(signOutCount(harness)).toBe(1);
    const snapshot = harness.auth.snapshot();
    expect(signOutReasonText(snapshot)).toBe(strings.auth.reasons.expired);
  });

  test("410 of the login of a deleted account deletes it in Firebase too (ADR 0056, D5)", async () => {
    const harness = setup();
    const { client, http } = api(harness);
    http.enqueue(
      jsonAnswer(403, { title: "x", status: 403, code: "identity.user-not-registered" }),
      jsonAnswer(410, { title: "x", status: 410, code: "identity.account-deleted" }),
    );
    const result = await client.listMyGroups();
    expect(result.ok).toBe(false);
    // Waits for the end the 410 started; it would sign out instead if nothing had started.
    await harness.ender.end("expired");
    expect(callsOf(harness.auth)).toEqual(["deleteAccount", "forgetProviderAccount"]);
    expect(signOutReasonText(harness.auth.snapshot())).toBe(strings.auth.reasons.deleted);
  });

  test("a late 410 of account A, with B signed in now, neither deletes B nor ends its session", async () => {
    const harness = setup();
    const { client, http } = api(harness);
    http.enqueue(
      jsonAnswer(403, { title: "x", status: 403, code: "identity.user-not-registered" }),
      jsonAnswer(410, { title: "x", status: 410, code: "identity.account-deleted" }),
    );
    const pending = client.listMyGroups();
    harness.auth.emit(SIGNED_IN_B, fakeSessionIdentity());
    expect((await pending).ok).toBe(false);
    await Promise.resolve();
    expect(callsOf(harness.auth)).toEqual([]);
    expect(harness.order).toEqual([]);
    expect(harness.auth.snapshot()).toEqual(SIGNED_IN_B);
  });
});

describe("the end of a deleted account (screen 30b)", () => {
  test("deletes in Firebase instead of signing out, then clears like any exit", async () => {
    const harness = setup();
    harness.client.setQueryData(queryKeys.group(GROUP_A), { name: "Racha" });
    await harness.ender.endDeleted(sessionOf(harness.auth));
    expect(harness.order).toEqual([
      "deleteAccount",
      "cancelQueries",
      "clearSession",
      "forgetProviderAccount",
    ]);
    expect(harness.client.getQueryData(queryKeys.group(GROUP_A))).toBeUndefined();
    expect(signOutReasonText(harness.auth.snapshot())).toBe("Sua conta foi excluída.");
  });

  test("the deletion of A after a switch to B does nothing", async () => {
    const harness = setup();
    const accountA = sessionOf(harness.auth);
    harness.auth.emit(SIGNED_IN_B, fakeSessionIdentity());
    await harness.ender.endDeleted(accountA);
    expect(harness.order).toEqual([]);
    expect(harness.auth.snapshot()).toEqual(SIGNED_IN_B);
  });
});
