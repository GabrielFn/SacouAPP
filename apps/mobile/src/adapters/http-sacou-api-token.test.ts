import { afterEach, describe, expect, test, vi } from "vitest";

import { createFakeHttpTransport, emptyAnswer, jsonAnswer } from "./fake-http-transport";
import { createFakeIdTokenProvider, FAKE_ID_TOKEN } from "./fake-id-token-provider";
import { createHttpSacouApi } from "./http-sacou-api";
import { BASE, GROUP, NOW, only, problem, setup } from "./http-sacou-api.test-support";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the token (P2, P3, H2)", () => {
  test("a 401 renews the token once and repeats; a second 401 ends the session", async () => {
    const { api, http, tokens } = setup();
    http.enqueue(problem(401), jsonAnswer(200, []));
    expect((await api.listMyGroups()).ok).toBe(true);

    http.enqueue(problem(401), problem(401));
    expect(await api.renameGroup(GROUP, "x")).toEqual({
      ok: false,
      error: { kind: "session-expired" },
    });

    expect(tokens.requests().forced).toBe(2);
    expect(tokens.sessionExpiredCount()).toBe(1);
    expect(http.requests()).toHaveLength(4);
  });

  test("three calls refused at once share one renewal", async () => {
    const tokens = createFakeIdTokenProvider();
    const { api, http } = setup({ tokens });
    const gate = tokens.holdRenewals();
    http.enqueue(
      problem(401),
      problem(401),
      problem(401),
      ...Array.from({ length: 3 }, () => jsonAnswer(200, [])),
    );

    const calls = [api.listMyGroups(), api.getGroup(GROUP), api.listMembers(GROUP)];
    await vi.waitFor(() => {
      expect(http.requests()).toHaveLength(3);
    });
    gate.release();

    expect((await Promise.all(calls)).every((result) => result.ok)).toBe(true);
    expect(tokens.requests().forced).toBe(1);
  });

  test("not registered signs in and repeats once; a second time is the rule error, without a loop", async () => {
    const { api, http } = setup();
    const notRegistered = () => problem(403, "identity.user-not-registered");
    http.enqueue(
      notRegistered(),
      jsonAnswer(201, { userId: "u" }),
      jsonAnswer(201, { groupId: GROUP }),
    );
    expect((await api.createGroup("Racha", "do-zero")).ok).toBe(true);
    expect(http.requests().map((request) => request.url)).toEqual([
      `${BASE}/v1/groups`,
      `${BASE}/v1/me`,
      `${BASE}/v1/groups`,
    ]);

    http.enqueue(
      notRegistered(),
      jsonAnswer(200, { userId: "u" }),
      notRegistered(),
      jsonAnswer(200, {}),
    );
    expect(await api.getGroup(GROUP)).toEqual({
      ok: false,
      error: { kind: "problem", status: 403, code: "identity.user-not-registered" },
    });
    expect(http.requests()).toHaveLength(6);
  });

  test("without a token nothing is sent and the session is over", async () => {
    const { api, http, tokens } = setup({ tokens: createFakeIdTokenProvider(null) });

    expect(await api.listMyGroups()).toEqual({ ok: false, error: { kind: "session-expired" } });
    expect(http.requests()).toHaveLength(0);
    expect(tokens.sessionExpiredCount()).toBe(1);
  });

  test("a renewal that rejects after a 401 is offline and does not end the session", async () => {
    const onSessionExpired = vi.fn();
    const getIdToken = vi.fn((options: { readonly forceRefresh: boolean }) =>
      options.forceRefresh
        ? Promise.reject(new Error("network-request-failed"))
        : Promise.resolve("token"),
    );
    const http = createFakeHttpTransport();
    const api = createHttpSacouApi({
      baseUrl: BASE,
      transport: http.transport,
      idTokens: { getIdToken, onSessionExpired },
      now: () => NOW,
      timeoutMs: 20,
    });
    http.enqueue(problem(401));

    expect(await api.listMyGroups()).toEqual({ ok: false, error: { kind: "offline" } });

    expect(getIdToken).toHaveBeenLastCalledWith({ forceRefresh: true });
    expect(onSessionExpired).not.toHaveBeenCalled();
    expect(http.requests()).toHaveLength(1);
  });

  test("a renewal the SDK refuses (null, not a rejection) after a 401 ends the session", async () => {
    const onSessionExpired = vi.fn();
    const getIdToken = vi.fn((options: { readonly forceRefresh: boolean }) =>
      Promise.resolve(options.forceRefresh ? null : "token"),
    );
    const http = createFakeHttpTransport();
    const api = createHttpSacouApi({
      baseUrl: BASE,
      transport: http.transport,
      idTokens: { getIdToken, onSessionExpired },
      now: () => NOW,
      timeoutMs: 20,
    });
    http.enqueue(problem(401));

    expect(await api.listMyGroups()).toEqual({ ok: false, error: { kind: "session-expired" } });

    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(http.requests()).toHaveLength(1);
  });

  test("a build without an API sends nothing", async () => {
    const { api, http } = setup({ baseUrl: null });

    expect(await api.listMyGroups()).toEqual({
      ok: false,
      error: { kind: "unexpected", status: 0 },
    });
    expect(http.requests()).toHaveLength(0);
  });
});

describe("where the token goes (H3, H4, H5)", () => {
  test("no result nor error carries the token, and nothing is logged", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((level) =>
      vi.spyOn(console, level),
    );
    const { api, http } = setup();
    const answers = [
      problem(401),
      problem(401),
      problem(409, "groups.x"),
      problem(500),
      problem(413),
      "network-error" as const,
      jsonAnswer(200, []),
    ];
    http.enqueue(...answers);

    const results = await Promise.all(Array.from({ length: 6 }, () => api.listMyGroups()));

    expect(JSON.stringify(results)).not.toContain(FAKE_ID_TOKEN);
    spies.forEach((spy) => {
      expect(spy).not.toHaveBeenCalled();
    });
  });

  test("a redirect is not followed and is unexpected", async () => {
    const { api, http } = setup();
    http.enqueue(emptyAnswer(302, { location: "https://evil.example/v1/groups" }));

    expect(await api.listMyGroups()).toEqual({
      ok: false,
      error: { kind: "unexpected", status: 302 },
    });
    expect(http.requests()).toHaveLength(1);
  });

  test("an answer that came from another origin is refused", async () => {
    const { api, http } = setup();
    const moved = jsonAnswer(200, []);
    Object.defineProperty(moved, "url", { value: "https://evil.example/v1/groups" });
    http.enqueue(moved);

    expect(await api.listMyGroups()).toEqual({
      ok: false,
      error: { kind: "unexpected", status: 0 },
    });
  });

  test("a path that leaves the origin is never sent", async () => {
    const { api, http } = setup({ baseUrl: "https://api.example" });
    // A group id that tries to climb out of the route stays a path segment of the API.
    http.enqueue(jsonAnswer(200, {}));
    await api.getGroup("@evil.example/x");

    const request = only(http);
    expect(request.url.startsWith(`${BASE}/v1/groups/`)).toBe(true);
  });

  test("a request that does not answer in time is offline", async () => {
    const { api, http } = setup();
    http.enqueue("never");

    expect(await api.listMyGroups()).toEqual({ ok: false, error: { kind: "offline" } });
    expect(only(http).signal.aborted).toBe(true);
  });

  test("no network is offline", async () => {
    const { api, http } = setup();
    http.enqueue("network-error");

    expect(await api.listMyGroups()).toEqual({ ok: false, error: { kind: "offline" } });
  });
});
