import { describe, expect, test } from "vitest";

import { E2_9_ROUND } from "../features/summary/model/e2-9-round.test.fixture";
import { jsonAnswer } from "./fake-http-transport";
import { BASE, GROUP, only, problem, setup } from "./http-sacou-api.test-support";

const ROUND = "8a4c2f0e-1111-4c3b-9d2e-000000000002";

describe("getRoundSummary over HTTP (E4.12)", () => {
  test("reads the summary of the round with a GET and the token of the account", async () => {
    const { api, http } = setup();
    http.enqueue(jsonAnswer(200, E2_9_ROUND));

    expect(await api.getRoundSummary(GROUP, ROUND)).toEqual({ ok: true, value: E2_9_ROUND });
    const request = only(http);
    expect(request.method).toBe("GET");
    expect(request.url).toBe(`${BASE}/v1/groups/${GROUP}/rounds/${ROUND}/summary`);
    expect(new Headers(request.headers).get("authorization")).toMatch(/^Bearer /);
    expect(request.body ?? "").toBe("");
  });

  test("a 404 becomes a problem the screen can name", async () => {
    const { api, http } = setup();
    http.enqueue(problem(404, "sessions.round-not-found"));

    const result = await api.getRoundSummary(GROUP, ROUND);
    expect(result).toMatchObject({ ok: false, error: { kind: "problem", status: 404 } });
  });
});
