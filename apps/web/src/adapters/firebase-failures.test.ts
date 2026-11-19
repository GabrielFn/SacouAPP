import { describe, expect, it } from "vitest";

import { outcomeOf, resetOutcomeOf } from "./firebase-failures";

describe("Firebase outcomes", () => {
  it("joins the wrong password and the unknown user, so the page is no oracle", () => {
    expect(outcomeOf({ code: "auth/wrong-password" })).toEqual(
      outcomeOf({ code: "auth/user-not-found" }),
    );
    expect(outcomeOf({ code: "auth/invalid-credential" })).toEqual({
      kind: "failed",
      failure: { kind: "invalidCredentials" },
    });
  });

  it("a blocked popup goes to the redirect, a closed one is a cancel", () => {
    expect(outcomeOf({ code: "auth/popup-blocked" })).toEqual({ kind: "popupBlocked" });
    expect(outcomeOf({ code: "auth/popup-closed-by-user" })).toEqual({ kind: "cancelled" });
  });

  it("an unknown error is unexpected", () => {
    expect(outcomeOf(new Error("boom"))).toEqual({
      kind: "failed",
      failure: { kind: "unexpected" },
    });
  });

  it("the reset link says done for an unknown e-mail, and only no connection otherwise", () => {
    expect(resetOutcomeOf({ code: "auth/user-not-found" })).toEqual({ kind: "done" });
    expect(resetOutcomeOf({ code: "auth/network-request-failed" })).toEqual({
      kind: "failed",
      failure: { kind: "offline" },
    });
  });
});
