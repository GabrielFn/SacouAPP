import { describe, expect, it } from "vitest";

import { failureOf } from "./api-failures";

const refused = { code: null, retryAfter: null, joined: null };

describe("failureOf", () => {
  it("reads Retry-After on a 429, at least one second", () => {
    expect(
      failureOf({ ...refused, status: 429, code: "api.rate-limited", retryAfter: "17" }),
    ).toEqual({
      kind: "rateLimited",
      retryAfterSeconds: 17,
    });
    expect(failureOf({ ...refused, status: 429, retryAfter: "x" })).toEqual({
      kind: "rateLimited",
      retryAfterSeconds: 1,
    });
  });

  it("a 503 is no connection with the Sacou, and a 410 the deleted account", () => {
    expect(failureOf({ ...refused, status: 503 })).toEqual({ kind: "offline" });
    expect(failureOf({ ...refused, status: 410, code: "identity.account-deleted" })).toEqual({
      kind: "accountDeleted",
    });
  });

  it("names the refusals of the link and of the group, and keeps joined", () => {
    expect(failureOf({ ...refused, status: 403, code: "groups.member-removed" })).toEqual({
      kind: "removed",
    });
    expect(failureOf({ ...refused, status: 409, code: "groups.member-limit" })).toEqual({
      kind: "groupFull",
    });
    expect(failureOf({ ...refused, status: 409, code: "groups.membership-limit" })).toEqual({
      kind: "groupFull",
    });
    expect(failureOf({ ...refused, status: 404, code: "sessions.round-link-invalid" })).toEqual({
      kind: "linkInvalid",
    });
    expect(failureOf({ ...refused, status: 409, code: "sessions.round-closed" })).toEqual({
      kind: "roundClosed",
    });
    expect(
      failureOf({ ...refused, status: 409, code: "sessions.drop-in-window-closed", joined: true }),
    ).toEqual({
      kind: "dropInWindowClosed",
      joined: true,
    });
    expect(
      failureOf({ ...refused, status: 409, code: "sessions.round-full", joined: false }),
    ).toEqual({ kind: "roundFull", joined: false });
  });

  it("anything else is unexpected", () => {
    expect(failureOf({ ...refused, status: 400, code: "something.else" })).toEqual({
      kind: "unexpected",
    });
    expect(failureOf({ ...refused, status: 500 })).toEqual({ kind: "unexpected" });
  });
});
