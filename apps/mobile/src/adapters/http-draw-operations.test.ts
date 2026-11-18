import { describe, expect, test } from "vitest";

import { jsonAnswer } from "./fake-http-transport";
import { BASE, GROUP, only, problem, setup } from "./http-sacou-api.test-support";

const ROUND = "8a4c2f0e-5555-4c3b-9d2e-000000000005";
const ANA = "8a4c2f0e-6666-4c3b-9d2e-000000000006";
const JOAO = "8a4c2f0e-7777-4c3b-9d2e-000000000007";

const ANSWER = {
  seed: "42",
  playersPerTeam: 1,
  teams: [
    { number: 1, members: [{ memberId: ANA, levelTenths: 40 }], averageTenths: 40 },
    { number: 2, members: [{ memberId: JOAO, levelTenths: 38 }], averageTenths: 38 },
  ],
  reserves: [],
  differenceTenths: 2,
};

describe("drawTeams (screen 07)", () => {
  test("posts the locks and the reserves as they are, and gives the answer", async () => {
    const { api, http } = setup();
    http.enqueue(jsonAnswer(200, ANSWER));

    const result = await api.drawTeams(GROUP, ROUND, {
      locks: [{ first: ANA, second: JOAO, kind: "together" }],
      reserves: [],
    });

    const request = only(http);
    expect(request.method).toBe("POST");
    expect(request.url).toBe(`${BASE}/v1/groups/${GROUP}/rounds/${ROUND}/draw`);
    expect(JSON.parse(request.body ?? "null")).toEqual({
      locks: [{ first: ANA, second: JOAO, kind: "together" }],
      reserves: [],
    });
    expect(result).toEqual({ ok: true, value: ANSWER });
  });

  test.each([
    [400, "sessions.draw-not-enough-players"],
    [400, "sessions.draw-reserves-invalid"],
    [400, "sessions.draw-lock-invalid"],
    [400, "sessions.draw-lock-too-large"],
    [400, "sessions.draw-locks-conflict"],
    [400, "sessions.draw-locks-unsatisfiable"],
    [409, "sessions.draw-disabled"],
    [409, "sessions.round-closed"],
    [404, "sessions.round-not-found"],
    [403, "groups.forbidden"],
  ] as const)("a %s with %s is the problem of its code", async (status, code) => {
    const { api, http } = setup();
    http.enqueue(problem(status, code));

    expect(await api.drawTeams(GROUP, ROUND, {})).toEqual({
      ok: false,
      error: { kind: "problem", status, code },
    });
  });
});
