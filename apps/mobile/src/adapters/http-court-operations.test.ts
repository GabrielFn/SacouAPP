import { describe, expect, test } from "vitest";

import { makeEnvelope } from "../features/court/persistence/log-envelopes.test.fixture";
import type { IdTokenProvider } from "../services/api/id-token-provider";
import type { SessionIdentity } from "../services/auth/auth-session";
import { createFakeHttpTransport, jsonAnswer } from "./fake-http-transport";
import { createFakeIdTokenProvider, FAKE_ID_TOKEN } from "./fake-id-token-provider";
import { createHttpSacouApi } from "./http-sacou-api";
import { BASE, GROUP, NOW, only, setup } from "./http-sacou-api.test-support";

const REF = {
  groupId: GROUP,
  roundId: "8a4c2f0e-1111-4c3b-9d2e-000000000002",
  courtSessionId: "c0000000-0000-4000-8000-00000000000a",
};
const ENVELOPES = [makeEnvelope({ sequence: 1 }), makeEnvelope({ sequence: 2 })];

function sessionOf(tokens: IdTokenProvider): SessionIdentity {
  const session = tokens.currentSession();
  if (session === null) throw new Error("no session");
  return session;
}

describe("appendCourtEvents over HTTP (E4.11, D9)", () => {
  test("posts the envelopes as the log has them, with the token of the account", async () => {
    const { api, http, tokens } = setup();
    http.enqueue(jsonAnswer(200, { lastSequence: 2, stored: 2 }));

    expect(await api.appendCourtEvents(REF, ENVELOPES, sessionOf(tokens))).toEqual({
      ok: true,
      value: { lastSequence: 2, stored: 2 },
    });
    const request = only(http);
    expect(request.method).toBe("POST");
    expect(request.url).toBe(
      `${BASE}/v1/groups/${REF.groupId}/rounds/${REF.roundId}/court-sessions/${REF.courtSessionId}/events`,
    );
    expect(new Headers(request.headers).get("authorization")).toBe(`Bearer ${FAKE_ID_TOKEN}`);
    expect(JSON.parse(request.body ?? "")).toEqual({ events: ENVELOPES });
  });

  test("another account signed in: nothing is sent", async () => {
    const { api, http } = setup();
    const other: SessionIdentity = Object.freeze({ opaque: Symbol("other") });

    expect(await api.appendCourtEvents(REF, ENVELOPES, other)).toEqual({
      ok: false,
      error: { kind: "account-changed" },
    });
    expect(http.requests()).toEqual([]);
  });

  test("the account changes while the token is read: nothing is sent", async () => {
    const base = createFakeIdTokenProvider();
    const first = sessionOf(base);
    const switched = { value: false };
    const tokens: IdTokenProvider = {
      ...base,
      currentSession: () => (switched.value ? Object.freeze({ opaque: Symbol("b") }) : first),
      async getIdToken(options) {
        switched.value = true;
        return base.getIdToken(options);
      },
    };
    const http = createFakeHttpTransport();
    const api = createHttpSacouApi({
      baseUrl: BASE,
      transport: http.transport,
      idTokens: tokens,
      now: () => NOW,
    });

    expect(await api.appendCourtEvents(REF, ENVELOPES, first)).toEqual({
      ok: false,
      error: { kind: "account-changed" },
    });
    expect(http.requests()).toEqual([]);
  });

  test("a 422 keeps only the code and the refused event", async () => {
    const { api, http, tokens } = setup();
    const refused = ENVELOPES[1]?.eventId;
    http.enqueue(
      jsonAnswer(422, {
        title: "x",
        status: 422,
        code: "matches.event-rejected",
        eventId: refused,
        reason: "set-decided",
      }),
    );

    expect(await api.appendCourtEvents(REF, ENVELOPES, sessionOf(tokens))).toEqual({
      ok: false,
      error: {
        kind: "problem",
        status: 422,
        code: "matches.event-rejected",
        details: { eventId: refused },
      },
    });
  });
});

describe("taking the court over over HTTP (E4.11, D9)", () => {
  const STREAM = `${BASE}/v1/groups/${REF.groupId}/rounds/${REF.roundId}/court-sessions/${REF.courtSessionId}`;

  test("reads the summary of the round", async () => {
    const { api, http, tokens } = setup();
    const summary = {
      courtSessionId: REF.courtSessionId,
      currentBatch: 1,
      eventCount: 3,
      writer: { memberId: GROUP, since: "2026-11-18T21:14:00Z" },
      lastEventAt: null,
      scoreboard: null,
    };
    http.enqueue(jsonAnswer(200, summary));

    expect(await api.getCourtSession(REF.groupId, REF.roundId, sessionOf(tokens))).toEqual({
      ok: true,
      value: summary,
    });
    expect(only(http).url).toBe(
      `${BASE}/v1/groups/${REF.groupId}/rounds/${REF.roundId}/court-session`,
    );
  });

  test("takes over with the token of the account and the expected stream", async () => {
    const { api, http, tokens } = setup();
    http.enqueue(jsonAnswer(200, { batch: 2, eventsBefore: 3, lastSequence: 0 }));
    const body = {
      deviceId: "d0000000-0000-4000-8000-000000000001",
      expectedBatch: 1,
      expectedEventCount: 3,
    };

    expect(await api.takeOverCourt(REF, body, sessionOf(tokens))).toEqual({
      ok: true,
      value: { batch: 2, eventsBefore: 3, lastSequence: 0 },
    });
    const request = only(http);
    expect(request.method).toBe("POST");
    expect(request.url).toBe(`${STREAM}/takeover`);
    expect(JSON.parse(request.body ?? "")).toEqual(body);
  });

  test("lists a page after a position, untyped", async () => {
    const { api, http, tokens } = setup();
    http.enqueue(jsonAnswer(200, { events: [], lastPosition: 5, eventCount: 5 }));

    expect(await api.listCourtEvents(REF, 5, sessionOf(tokens))).toEqual({
      ok: true,
      value: { events: [], lastPosition: 5, eventCount: 5 },
    });
    expect(only(http).url).toBe(`${STREAM}/events?after=5`);
    expect(new Headers(only(http).headers).get("authorization")).toBe(`Bearer ${FAKE_ID_TOKEN}`);
  });

  test("another account signed in: neither the summary nor a page is read", async () => {
    const { api, http } = setup();
    const other: SessionIdentity = Object.freeze({ opaque: Symbol("other") });
    const changed = { ok: false, error: { kind: "account-changed" } };

    expect(await api.getCourtSession(REF.groupId, REF.roundId, other)).toEqual(changed);
    expect(await api.listCourtEvents(REF, 0, other)).toEqual(changed);
    expect(http.requests()).toEqual([]);
  });
});
