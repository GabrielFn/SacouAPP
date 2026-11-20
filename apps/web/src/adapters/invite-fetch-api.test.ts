import { describe, expect, it } from "vitest";

import { createInviteFetchApi } from "./invite-fetch-api";

const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCde";

interface Sent {
  readonly url: string;
  readonly init: RequestInit;
}

function api(response: Response) {
  const sent: Sent[] = [];
  const port = createInviteFetchApi({
    fetch: (url, init) => {
      sent.push({ url, init });
      return Promise.resolve(response);
    },
    idToken: () => Promise.resolve("id-token"),
  });
  return { port, sent };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("createInviteFetchApi", () => {
  it("previews with the token in the JSON body only, signed, and without a cookie", async () => {
    const { port, sent } = api(
      json(200, { groupName: "Racha", activeMembers: 3, alreadyMember: false }),
    );

    expect(await port.preview(TOKEN)).toEqual({
      ok: true,
      value: { groupName: "Racha", activeMembers: 3, alreadyMember: false },
    });
    const [request] = sent;
    expect(request?.url).toBe("/v1/invites/preview");
    expect(request?.init.method).toBe("POST");
    expect(request?.init.credentials).toBe("omit");
    expect(request?.init.headers).toMatchObject({ Authorization: "Bearer id-token" });
    expect(JSON.parse(request?.init.body as string)).toEqual({ token: TOKEN });
  });

  it("accepts with 201 and with 200, and maps the dead link", async () => {
    expect(await api(json(201, { groupId: "g", memberId: "m" })).port.accept(TOKEN)).toEqual({
      ok: true,
      value: null,
    });
    expect(await api(json(200, { groupId: "g", memberId: "m" })).port.accept(TOKEN)).toEqual({
      ok: true,
      value: null,
    });
    expect(await api(json(404, { code: "groups.invite-invalid" })).port.accept(TOKEN)).toEqual({
      ok: false,
      failure: { kind: "inviteInvalid" },
    });
  });

  it("a preview of another shape is unexpected", async () => {
    expect(await api(json(200, { groupName: 1 })).port.preview(TOKEN)).toEqual({
      ok: false,
      failure: { kind: "unexpected" },
    });
  });

  it("registers with POST /v1/me", async () => {
    const { port, sent } = api(json(200, {}));
    expect(await port.register()).toEqual({ ok: true, value: null });
    expect(sent[0]?.url).toBe("/v1/me");
  });
});
