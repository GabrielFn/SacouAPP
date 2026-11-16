import { describe, expect, test } from "vitest";

import { emptyAnswer, jsonAnswer } from "./fake-http-transport";
import { FAKE_ID_TOKEN } from "./fake-id-token-provider";
import { BASE, GROUP, only, problem, setup } from "./http-sacou-api.test-support";

describe("export and deletion of the account (ADR 0056)", () => {
  test("the export is a GET of /v1/me/export and gives the open document", async () => {
    const { api, http } = setup();
    const document = { format: "sacou-personal-data", version: 1, profile: null };
    http.enqueue(jsonAnswer(200, document));
    expect(await api.exportMyData()).toEqual({ ok: true, value: document });
    const request = only(http);
    expect(request.method).toBe("GET");
    expect(request.url).toBe(`${BASE}/v1/me/export`);
    expect(request.headers.get("authorization")).toBe(`Bearer ${FAKE_ID_TOKEN}`);
  });

  test("the blockers come out of their envelope", async () => {
    const { api, http } = setup();
    const blockers = [{ groupId: GROUP, groupName: "Racha de terça", kind: "lastAdmin" }];
    http.enqueue(jsonAnswer(200, { blockers }));
    expect(await api.getDeletionBlockers()).toEqual({ ok: true, value: blockers });
    expect(only(http).url).toBe(`${BASE}/v1/me/deletion-blockers`);
  });

  test("the deletion is a DELETE of /v1/me without a body; 204 gives null", async () => {
    const { api, http } = setup();
    http.enqueue(emptyAnswer(204));
    expect(await api.deleteMyAccount()).toEqual({ ok: true, value: null });
    const request = only(http);
    expect(request.method).toBe("DELETE");
    expect(request.url).toBe(`${BASE}/v1/me`);
    expect(request.body).toBeNull();
  });

  test.each([
    [409, "identity.deletion-blocked"],
    [403, "identity.recent-login-required"],
  ])("%i %s is the problem of its code", async (status, code) => {
    const { api, http } = setup();
    http.enqueue(problem(status, code));
    expect(await api.deleteMyAccount()).toEqual({
      ok: false,
      error: { kind: "problem", status, code },
    });
  });

  test("410 of the login of a deleted account tells the token provider once", async () => {
    const { api, http, tokens } = setup();
    http.enqueue(problem(403, "identity.user-not-registered"), problem(410, "identity.account-deleted"));
    const result = await api.listMyGroups();
    expect(result).toEqual({
      ok: false,
      error: { kind: "problem", status: 410, code: "identity.account-deleted" },
    });
    expect(tokens.accountDeletedCount()).toBe(1);
    expect(tokens.sessionExpiredCount()).toBe(0);
  });

  test("another refusal of the login does not", async () => {
    const { api, http, tokens } = setup();
    http.enqueue(problem(403, "identity.user-not-registered"), problem(400, "identity.subject-invalid"));
    await api.listMyGroups();
    expect(tokens.accountDeletedCount()).toBe(0);
  });
});
