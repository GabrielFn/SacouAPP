import { afterEach, describe, expect, test, vi } from "vitest";

import type { paths } from "../api/generated/schema";
import type { ApiResult } from "../services/api/api-result";
import type { SacouApi } from "../services/api/sacou-api";
import { emptyAnswer, jsonAnswer } from "./fake-http-transport";
import { FAKE_ID_TOKEN } from "./fake-id-token-provider";
import { BASE, GROUP, only, problem, setup } from "./http-sacou-api.test-support";

const MEMBER = "8a4c2f0e-2222-4c3b-9d2e-000000000002";
const TEMPLATE = "8a4c2f0e-4444-4c3b-9d2e-000000000004";
const INVITE = "8a4c2f0e-3333-4c3b-9d2e-000000000003";
const INVITE_TOKEN = "invite-token-Qw7";
const ROUND = "8a4c2f0e-5555-4c3b-9d2e-000000000005";
const ROUND_BODY = {
  localDate: "2026-11-17",
  localTime: "20:30",
  venue: "Ginásio Sesc",
  settings: null,
  repeatWeekly: true,
};

type Operation = readonly [
  string,
  (api: SacouApi) => Promise<ApiResult<unknown>>,
  string,
  keyof paths,
  string,
  unknown,
];

/** Method, path template of the generated `paths` and body of every operation (H1). */
const GUEST_BODY = {
  requestId: "00000000-0000-4000-8000-000000000001",
  name: "Duda",
  primaryPosition: "outsideHitter",
  level: null,
};

const DRAW_BODY = {
  locks: [{ first: MEMBER, second: INVITE, kind: "together" as const }],
  reserves: [TEMPLATE],
};

const OPERATIONS: readonly Operation[] = [
  ["signIn", (a) => a.signIn(), "POST", "/v1/me", "/v1/me", null],
  ["listMyGroups", (a) => a.listMyGroups(), "GET", "/v1/groups", "/v1/groups", null],
  [
    "createGroup",
    (a) => a.createGroup("Racha", "racha-organizado"),
    "POST",
    "/v1/groups",
    "/v1/groups",
    { name: "Racha", templateKey: "racha-organizado" },
  ],
  [
    "getGroupSettings",
    (a) => a.getGroupSettings(GROUP),
    "GET",
    "/v1/groups/{groupId}/settings",
    `/v1/groups/${GROUP}/settings`,
    null,
  ],
  [
    "updateGroupSettings",
    (a) => a.updateGroupSettings(GROUP, { schemaVersion: 1, queue: { enabled: false } }),
    "PATCH",
    "/v1/groups/{groupId}/settings",
    `/v1/groups/${GROUP}/settings`,
    { settings: { schemaVersion: 1, queue: { enabled: false } } },
  ],
  [
    "applyTemplate",
    (a) => a.applyTemplate(GROUP, { kind: "ready", key: "treino" }),
    "POST",
    "/v1/groups/{groupId}/settings/apply-template",
    `/v1/groups/${GROUP}/settings/apply-template`,
    { templateKey: "treino", savedTemplateId: null },
  ],
  [
    "applyTemplate (saved)",
    (a) => a.applyTemplate(GROUP, { kind: "saved", templateId: TEMPLATE }),
    "POST",
    "/v1/groups/{groupId}/settings/apply-template",
    `/v1/groups/${GROUP}/settings/apply-template`,
    { templateKey: null, savedTemplateId: TEMPLATE },
  ],
  [
    "listTemplates",
    (a) => a.listTemplates(GROUP),
    "GET",
    "/v1/groups/{groupId}/templates",
    `/v1/groups/${GROUP}/templates`,
    null,
  ],
  [
    "saveTemplate",
    (a) => a.saveTemplate(GROUP, "Meu racha"),
    "POST",
    "/v1/groups/{groupId}/templates",
    `/v1/groups/${GROUP}/templates`,
    { name: "Meu racha" },
  ],
  [
    "deleteTemplate",
    (a) => a.deleteTemplate(GROUP, TEMPLATE),
    "DELETE",
    "/v1/groups/{groupId}/templates/{templateId}",
    `/v1/groups/${GROUP}/templates/${TEMPLATE}`,
    null,
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
    "listMemberLevels",
    (a) => a.listMemberLevels(GROUP),
    "GET",
    "/v1/groups/{groupId}/member-levels",
    `/v1/groups/${GROUP}/member-levels`,
    null,
  ],
  [
    "setMemberLevel",
    (a) => a.setMemberLevel({ groupId: GROUP, memberId: MEMBER }, 3.5),
    "PUT",
    "/v1/groups/{groupId}/member-levels/{memberId}",
    `/v1/groups/${GROUP}/member-levels/${MEMBER}`,
    { level: 3.5 },
  ],
  [
    "setMemberLevel (Não sei)",
    (a) => a.setMemberLevel({ groupId: GROUP, memberId: MEMBER }, null),
    "PUT",
    "/v1/groups/{groupId}/member-levels/{memberId}",
    `/v1/groups/${GROUP}/member-levels/${MEMBER}`,
    { level: null },
  ],
  [
    "setMemberLevels",
    (a) => a.setMemberLevels(GROUP, [{ memberId: MEMBER, level: 4 }]),
    "PUT",
    "/v1/groups/{groupId}/member-levels",
    `/v1/groups/${GROUP}/member-levels`,
    { levels: [{ memberId: MEMBER, level: 4 }] },
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
  [
    "listRounds",
    (a) => a.listRounds(GROUP),
    "GET",
    "/v1/groups/{groupId}/rounds",
    `/v1/groups/${GROUP}/rounds`,
    null,
  ],
  [
    "getRound",
    (a) => a.getRound(GROUP, ROUND),
    "GET",
    "/v1/groups/{groupId}/rounds/{roundId}",
    `/v1/groups/${GROUP}/rounds/${ROUND}`,
    null,
  ],
  [
    "createRound",
    (a) => a.createRound(GROUP, ROUND_BODY),
    "POST",
    "/v1/groups/{groupId}/rounds",
    `/v1/groups/${GROUP}/rounds`,
    ROUND_BODY,
  ],
  [
    "updateRound",
    (a) =>
      a.updateRound(GROUP, ROUND, {
        localDate: null,
        localTime: "19:00",
        venue: null,
        settings: {},
      }),
    "PATCH",
    "/v1/groups/{groupId}/rounds/{roundId}",
    `/v1/groups/${GROUP}/rounds/${ROUND}`,
    { localDate: null, localTime: "19:00", venue: null, settings: {} },
  ],
  [
    "respondAttendance",
    (a) => a.respondAttendance(GROUP, ROUND, "going"),
    "PUT",
    "/v1/groups/{groupId}/rounds/{roundId}/attendance/me",
    `/v1/groups/${GROUP}/rounds/${ROUND}/attendance/me`,
    { response: "going" },
  ],
  [
    "setMemberAttendance",
    (a) => a.setMemberAttendance({ groupId: GROUP, roundId: ROUND, memberId: MEMBER }, "notGoing"),
    "PUT",
    "/v1/groups/{groupId}/rounds/{roundId}/attendance/{memberId}",
    `/v1/groups/${GROUP}/rounds/${ROUND}/attendance/${MEMBER}`,
    { response: "notGoing" },
  ],
  [
    "addGuest",
    (a) => a.addGuest(GROUP, GUEST_BODY),
    "POST",
    "/v1/groups/{groupId}/guests",
    `/v1/groups/${GROUP}/guests`,
    GUEST_BODY,
  ],
  [
    "drawTeams",
    (a) => a.drawTeams(GROUP, ROUND, DRAW_BODY),
    "POST",
    "/v1/groups/{groupId}/rounds/{roundId}/draw",
    `/v1/groups/${GROUP}/rounds/${ROUND}/draw`,
    DRAW_BODY,
  ],
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("every operation builds the request of the contract (H1)", () => {
  test("the table covers the 32 operations", () => {
    expect(new Set(OPERATIONS.map(([name]) => name.split(" ")[0])).size).toBe(32);
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

    expect(await api.createGroup("Racha", "do-zero")).toEqual({
      ok: false,
      error: { kind: "unavailable", retryAfterMs: 30_000 },
    });
    expect(http.requests()).toHaveLength(1);
  });
});
