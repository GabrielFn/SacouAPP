import { describe, expect, it } from "vitest";

import { createFetchApi } from "./fetch-api";

interface Sent {
  readonly url: string;
  readonly init: RequestInit;
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function api(responses: readonly Response[], token: string | null = "id-token") {
  const sent: Sent[] = [];
  const queue = [...responses];
  const port = createFetchApi({
    fetch: (url, init) => {
      sent.push({ url, init });
      const next = queue.shift();
      return next === undefined ? Promise.reject(new TypeError("offline")) : Promise.resolve(next);
    },
    idToken: () => Promise.resolve(token),
  });
  return { port, sent };
}

const CODE = "K7fQ2xK7fQ2xK7fQ2xK7fQ";

describe("createFetchApi", () => {
  it("answers with the code in the JSON body, the token in Authorization and no cookie", async () => {
    const { port, sent } = api([
      json(200, {
        groupId: "g",
        roundId: "r",
        memberId: "m",
        joined: true,
        status: "waitlisted",
        position: 2,
      }),
    ]);

    expect(await port.answer(CODE, "going")).toEqual({
      ok: true,
      value: { status: "waitlisted", position: 2 },
    });
    const [request] = sent;
    expect(request?.url).toBe("/v1/round-links/attendance");
    expect(request?.url).not.toContain(CODE);
    expect(request?.init.method).toBe("POST");
    expect(request?.init.credentials).toBe("omit");
    expect(request?.init.headers).toEqual({
      Authorization: "Bearer id-token",
      Accept: "application/json",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(request?.init.body as string)).toEqual({ code: CODE, response: "going" });
  });

  it("reads the refusal's code, joined and Retry-After", async () => {
    const closed = api([json(409, { code: "sessions.drop-in-window-closed", joined: true })]);
    expect(await closed.port.answer(CODE, "going")).toEqual({
      ok: false,
      failure: { kind: "dropInWindowClosed", joined: true },
    });
    const limited = api([json(429, { code: "api.rate-limited" }, { "Retry-After": "12" })]);
    expect(await limited.port.answer(CODE, "going")).toEqual({
      ok: false,
      failure: { kind: "rateLimited", retryAfterSeconds: 12 },
    });
  });

  it("no network is offline, and no session is unexpected without a request", async () => {
    expect(await api([]).port.answer(CODE, "going")).toEqual({
      ok: false,
      failure: { kind: "offline" },
    });
    const signedOut = api([], null);
    expect(await signedOut.port.answer(CODE, "going")).toEqual({
      ok: false,
      failure: { kind: "unexpected" },
    });
    expect(signedOut.sent).toHaveLength(0);
  });

  it("registers, then tells a missing profile (404) from a saved one", async () => {
    const missing = api([
      json(201, { userId: "u" }),
      json(404, { code: "identity.profile-not-found" }),
    ]);
    expect(await missing.port.register()).toEqual({ ok: true, value: { hasProfile: false } });
    const saved = api([json(200, { userId: "u" }), json(200, { nickname: "Ana" })]);
    expect(await saved.port.register()).toEqual({ ok: true, value: { hasProfile: true } });
    const deleted = api([json(410, { code: "identity.account-deleted" })]);
    expect(await deleted.port.register()).toEqual({
      ok: false,
      failure: { kind: "accountDeleted" },
    });
  });

  it("saves only the nickname", async () => {
    const { port, sent } = api([json(200, { nickname: "Aninha" })]);
    expect(await port.saveNickname("Aninha")).toEqual({ ok: true, value: null });
    expect(sent[0]?.init.method).toBe("PUT");
    expect(JSON.parse(sent[0]?.init.body as string)).toEqual({
      nickname: "Aninha",
      primaryPosition: null,
      otherPositions: null,
      suggestedLevel: null,
    });
  });

  it("the standing of a member comes from the round; a stranger or a closed round has none", async () => {
    const member = api([
      json(200, { isOpen: true, groupId: "g1", roundId: "r1", isMember: true }),
      json(200, { me: { memberId: "m", status: "going", position: 3, regularPosition: null } }),
    ]);
    expect(await member.port.standing(CODE)).toEqual({
      ok: true,
      value: { status: "going", position: 3 },
    });
    expect(member.sent[1]?.url).toBe("/v1/groups/g1/rounds/r1");
    const stranger = api([
      json(200, { isOpen: true, groupId: "g1", roundId: "r1", isMember: false }),
    ]);
    expect(await stranger.port.standing(CODE)).toEqual({ ok: true, value: null });
    expect(stranger.sent).toHaveLength(1);
    const closed = api([
      json(200, { isOpen: false, groupId: null, roundId: null, isMember: true }),
    ]);
    expect(await closed.port.standing(CODE)).toEqual({ ok: true, value: null });
  });

  it("a member without an answer yet has no standing", async () => {
    const { port } = api([
      json(200, { isOpen: true, groupId: "g1", roundId: "r1", isMember: true }),
      json(200, { me: { memberId: "m", status: null, position: null, regularPosition: null } }),
    ]);
    expect(await port.standing(CODE)).toEqual({ ok: true, value: null });
  });
});
