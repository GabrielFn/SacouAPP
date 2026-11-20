import { describe, expect, it } from "vitest";

import { initialInvitePageState, invitePageReducer } from "./invite-page.reducer";
import type { InvitePageState, InvitePreview } from "./invite-page.types";

const PREVIEW: InvitePreview = { groupName: "Racha", activeMembers: 3, alreadyMember: false };
const previewing: InvitePageState = { step: "previewing" };
const shown: InvitePageState = { step: "preview", preview: PREVIEW, failure: null };

describe("invitePageReducer", () => {
  it("starts: no token is a dead link; a session goes to the preview; none waits for the sign-in", () => {
    expect(invitePageReducer(initialInvitePageState, { type: "tokenRejected" })).toEqual({
      step: "failed",
      failure: { kind: "inviteInvalid" },
    });
    expect(
      invitePageReducer(initialInvitePageState, { type: "sessionChecked", signedIn: true }),
    ).toEqual(previewing);
    expect(
      invitePageReducer(initialInvitePageState, { type: "sessionChecked", signedIn: false }),
    ).toEqual({ step: "idle", signedIn: false, failure: null });
  });

  it("the main button: the sheet when signed out, the preview again when signed in", () => {
    expect(
      invitePageReducer({ step: "idle", signedIn: false, failure: null }, { type: "signInTapped" }),
    ).toEqual({ step: "signIn", form: "choice", failure: null, notice: null });
    expect(
      invitePageReducer(
        { step: "idle", signedIn: true, failure: { kind: "offline" } },
        { type: "signInTapped" },
      ),
    ).toEqual(previewing);
  });

  it("the sheet: e-mail form, failure back to its form, reset notice, closed back to idle", () => {
    const open: InvitePageState = { step: "signIn", form: "choice", failure: null, notice: null };
    const email = invitePageReducer(open, { type: "formChosen", form: "signUp" });
    const trying = invitePageReducer(email, { type: "signInStarted", attempt: "signUp" });
    expect(
      invitePageReducer(trying, { type: "signInFailed", failure: { kind: "weakPassword" } }),
    ).toEqual({ step: "signIn", form: "signUp", failure: { kind: "weakPassword" }, notice: null });
    const reset = invitePageReducer({ step: "signingIn", attempt: "reset" }, { type: "resetSent" });
    expect(reset).toEqual({ step: "signIn", form: "signIn", failure: null, notice: "resetSent" });
    expect(invitePageReducer(trying, { type: "signedIn" })).toEqual(previewing);
    expect(invitePageReducer(open, { type: "sheetClosed" })).toEqual({
      step: "idle",
      signedIn: false,
      failure: null,
    });
  });

  it("preview failures: dead ends end the flow, the rest can be tried again", () => {
    for (const kind of ["inviteInvalid", "removed", "groupFull"] as const) {
      expect(invitePageReducer(previewing, { type: "previewFailed", failure: { kind } })).toEqual({
        step: "failed",
        failure: { kind },
      });
    }
    expect(
      invitePageReducer(previewing, { type: "previewFailed", failure: { kind: "offline" } }),
    ).toEqual({ step: "idle", signedIn: true, failure: { kind: "offline" } });
  });

  it("the join: joined with the group's name, or the preview with the failure", () => {
    const joining = invitePageReducer(shown, { type: "joinTapped" });
    expect(joining).toEqual({ step: "joining", preview: PREVIEW });
    expect(invitePageReducer(joining, { type: "joined" })).toEqual({
      step: "joined",
      groupName: "Racha",
      alreadyMember: false,
    });
    expect(
      invitePageReducer(joining, {
        type: "joinFailed",
        failure: { kind: "rateLimited", retryAfterSeconds: 3 },
      }),
    ).toEqual({ ...shown, failure: { kind: "rateLimited", retryAfterSeconds: 3 } });
  });

  it("a late answer of a stale request changes nothing", () => {
    expect(invitePageReducer(shown, { type: "joined" })).toBe(shown);
    expect(invitePageReducer(shown, { type: "previewLoaded", preview: PREVIEW })).toBe(shown);
    const failed: InvitePageState = { step: "failed", failure: { kind: "inviteInvalid" } };
    expect(invitePageReducer(failed, { type: "signedOut" })).toBe(failed);
  });
});
