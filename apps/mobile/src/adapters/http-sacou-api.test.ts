import { afterEach, describe, expect, test, vi } from "vitest";

import type { paths } from "../api/generated/schema";
import type { ApiResult } from "../services/api/api-result";
import type { SacouApi } from "../services/api/sacou-api";
import {
  createFakeHttpTransport,
  emptyAnswer,
  jsonAnswer,
  type FakeHttpTransport,
} from "./fake-http-transport";
import {
  createFakeIdTokenProvider,
  FAKE_ID_TOKEN,
  type FakeIdTokenProvider,
} from "./fake-id-token-provider";
import { createHttpSacouApi } from "./http-sacou-api";

const BASE = "https://api.example";
const GROUP = "8a4c2f0e-1111-4c3b-9d2e-000000000001";
const MEMBER = "8a4c2f0e-2222-4c3b-9d2e-000000000002";
const INVITE = "8a4c2f0e-3333-4c3b-9d2e-000000000003";
const INVITE_TOKEN = "invite-token-Qw7";
const NOW = Date.parse("2026-11-10T12:00:00Z");

function setup(options: { baseUrl?: string | null; tokens?: FakeIdTokenProvider } = {}) {
  const http = createFakeHttpTransport();
  const tokens = options.tokens ?? createFakeIdTokenProvider();
  const api = createHttpSacouApi({
    baseUrl: options.baseUrl === undefined ? BASE : options.baseUrl,
    transport: http.transport,
    idTokens: tokens,
    now: () => NOW,
    timeoutMs: 20,
  });
  return { api, http, tokens };
}

function problem(status: number, code?: string): Response {
  return jsonAnswer(status, { title: "x", status, ...(code === undefined ? {} : { code }) });
}

function only(http: FakeHttpTransport) {
  const [request] = http.requests();
  if (!request) throw new Error("nothing was sent");
  return request;
}

type Operation = readonly [
  string,
  (api: SacouApi) => Promise<ApiResult<unknown>>,
  string,
  keyof paths,
  string,
  unknown,
];

/** Method, path template of the generated `paths` and body of every operation (H1). */
const OPERATIONS: readonly Operation[] = [
  ["signIn", (a) => a.signIn(), "POST", "/v1/me", "/v1/me", null],
  ["listMyGroups", (a) => a.listMyGroups(), "GET", "/v1/groups", "/v1/groups", null],
  [
    "createGroup",
    (a) => a.createGroup("Racha"),
    "POST",
    "/v1/groups",
    "/v1/groups",
    { name: "Racha" },
  ],
  [
    "getGroup",
    (a) => a.getGroup(GROUP),
    "GET",
    "/v1/groups/{groupId}",
    `/v1/groups/${GROUP}`,
    null,
  ],
  [
    "renameGroup",
    (a) => a.renameGroup(GROUP, "Novo"),
    "PATCH",
    "/v1/groups/{groupId}",
    `/v1/groups/${GROUP}`,
    { name: "Novo" },
  ],
  [
    "listMembers",
    (a) => a.listMembers(GROUP),
    "GET",
    "/v1/groups/{groupId}/members",
    `/v1/groups/${GROUP}/members`,
    null,
  ],
  [
    "changeMemberRole",
    (a) => a.changeMemberRole({ groupId: GROUP, memberId: MEMBER }, "coAdmin"),
    "PUT",
    "/v1/groups/{groupId}/members/{memberId}/role",
    `/v1/groups/${GROUP}/members/${MEMBER}/role`,
    { role: "coAdmin" },
  ],
  [
    "changeMemberType",
    (a) => a.changeMemberType({ groupId: GROUP, memberId: MEMBER }, "dropIn"),
    "PUT",
    "/v1/groups/{groupId}/members/{memberId}/type",
    `/v1/groups/${GROUP}/members/${MEMBER}/type`,
    { memberType: "dropIn" },
  ],
  [
    "removeMember",
    (a) => a.removeMember({ groupId: GROUP, memberId: MEMBER }),
    "DELETE",
    "/v1/groups/{groupId}/members/{memberId}",
    `/v1/groups/${GROUP}/members/${MEMBER}`,
    null,
  ],
  [
    "leaveGroup",
    (a) => a.leaveGroup(GROUP),
    "POST",
    "/v1/groups/{groupId}/leave",
    `/v1/groups/${GROUP}/leave`,
    null,
  ],
  [
    "createInvite",
    (a) => a.createInvite(GROUP),
    "POST",
    "/v1/groups/{groupId}/invites",
    `/v1/groups/${GROUP}/invites`,
    null,
  ],
  [
    "listInvites",
    (a) => a.listInvites(GROUP),
    "GET",
    "/v1/groups/{groupId}/invites",
    `/v1/groups/${GROUP}/invites`,
    null,
  ],
  [
    "revokeInvite",
    (a) => a.revokeInvite(GROUP, INVITE),
    "DELETE",
    "/v1/groups/{groupId}/invites/{inviteId}",
    `/v1/groups/${GROUP}/invites/${INVITE}`,
    null,
  ],
  [
    "previewInvite",
    (a) => a.previewInvite(INVITE_TOKEN),
    "POST",
    "/v1/invites/preview",
    "/v1/invites/preview",
    { token: INVITE_TOKEN },
  ],
  [
    "acceptInvite",
    (a) => a.acceptInvite(INVITE_TOKEN),
    "POST",
    "/v1/invites/accept",
    "/v1/invites/accept",
    { token: INVITE_TOKEN },
  ],
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("every operation builds the request of the contract (H1)", () => {
  test("the table covers the 15 operations", () => {
    expect(new Set(OPERATIONS.map(([name]) => name)).size).toBe(15);
  });

  test.each(OPERATIONS)("%s", async (_name, call, method, _template, path, body) => {
    const { api, http } = setup();
    http.enqueue(jsonAnswer(200, {}));

    await call(api);

    const request = only(http);
    expect(request.method).toBe(method);
    expect(request.url).toBe(`${BASE}${path}`);
    expect(request.headers.get("authorization")).toBe(`Bearer ${FAKE_ID_TOKEN}`);
    expect(request.headers.get("accept")).toBe("application/json");
    expect(request.body === null ? null : (JSON.parse(request.body) as unknown)).toEqual(body);
  });
});

describe("answers", () => {
  test("a success gives the body, a 204 gives null", async () => {
    const { api, http } = setup();
    http.enqueue(jsonAnswer(200, [{ groupId: GROUP }]), emptyAnswer(204));

    expect(await api.listMyGroups()).toEqual({ ok: true, value: [{ groupId: GROUP }] });
    expect(await api.leaveGroup(GROUP)).toEqual({ ok: true, value: null });
  });

  test("a rule error is the problem of its code; a body that is not JSON is unexpected", async () => {
    const { api, http } = setup();
    http.enqueue(
      problem(409, "groups.last-admin"),
      new Response("<html>", { status: 200, headers: { "content-type": "text/html" } }),
    );

    expect(await api.leaveGroup(GROUP)).toEqual({
      ok: false,
      error: { kind: "problem", status: 409, code: "groups.last-admin" },
    });
    expect(await api.listMyGroups()).toEqual({
      ok: false,
      error: { kind: "unexpected", status: 0 },
    });
  });

  test("a JSON body under another content type is unexpected", async () => {
    const { api, http } = setup();
    http.enqueue(new Response("[]", { status: 200, headers: { "content-type": "text/plain" } }));

    expect(await api.listMyGroups()).toEqual({
      ok: false,
      error: { kind: "unexpected", status: 200 },
    });
  });

  test("a 503 is not repeated by the client and carries the wait", async () => {
    const { api, http } = setup();
    http.enqueue(problem(503), jsonAnswer(200, []));
    http.enqueue();

    expect(await api.createGroup("Racha")).toEqual({
      ok: false,
      error: { kind: "unavailable", retryAfterMs: 30_000 },
    });
    expect(http.requests()).toHaveLength(1);
  });
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
    expect((await api.createGroup("Racha")).ok).toBe(true);
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
