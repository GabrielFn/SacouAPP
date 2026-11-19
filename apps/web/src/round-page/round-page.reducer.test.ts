import { describe, expect, it } from "vitest";

import type { RoundPageAction } from "./round-page.actions";
import { initialRoundPageState, roundPageReducer } from "./round-page.reducer";
import type { RoundPageState } from "./round-page.types";

function run(
  actions: readonly RoundPageAction[],
  from: RoundPageState = initialRoundPageState,
): RoundPageState {
  return actions.reduce(roundPageReducer, from);
}

const signedOutIdle: RoundPageState = {
  step: "idle",
  signedIn: false,
  nicknameSuggestion: null,
  standing: null,
  failure: null,
};

const going = { status: "going", position: 10 } as const;

describe("roundPageReducer (case 31)", () => {
  it("starts signed out when Firebase has nobody", () => {
    expect(run([{ type: "sessionChecked", signedIn: false, pendingIntent: null }])).toEqual(
      signedOutIdle,
    );
  });

  it("registers a returning session and, with a profile, idles signed in", () => {
    const state = run([
      { type: "sessionChecked", signedIn: true, pendingIntent: null },
      { type: "registered", hasProfile: true, suggestion: "Ana" },
      { type: "standingLoaded", standing: going },
    ]);
    expect(state).toEqual({
      step: "idle",
      signedIn: true,
      nicknameSuggestion: null,
      standing: going,
      failure: null,
    });
  });

  it("VOU signed out opens the sheet, signs in, asks the nickname and answers", () => {
    const steps = [
      { type: "sessionChecked", signedIn: false, pendingIntent: null },
      { type: "answerTapped", intent: "going" },
      { type: "signInStarted", attempt: "google" },
      { type: "signedIn" },
      { type: "registered", hasProfile: false, suggestion: "Ana" },
    ] as const;
    expect(run(steps)).toEqual({
      step: "nickname",
      intent: "going",
      suggestion: "Ana",
      failure: null,
    });
    const answered = run(
      [
        { type: "nicknameSubmitted", nickname: "Aninha" },
        { type: "nicknameSaved" },
        { type: "answered", standing: going },
      ],
      run(steps),
    );
    expect(answered).toEqual({
      step: "idle",
      signedIn: true,
      nicknameSuggestion: null,
      standing: going,
      failure: null,
    });
  });

  it("keeps NÃO VOU through the sign-in and the registration", () => {
    const state = run([
      { type: "sessionChecked", signedIn: false, pendingIntent: null },
      { type: "answerTapped", intent: "notGoing" },
      { type: "formChosen", form: "signIn" },
      { type: "signInStarted", attempt: "signIn" },
      { type: "signedIn" },
      { type: "registered", hasProfile: true, suggestion: "" },
    ]);
    expect(state).toEqual({ step: "answering", intent: "notGoing", standing: null });
  });

  it("brings back the intent kept across the Google redirect", () => {
    const state = run([
      { type: "sessionChecked", signedIn: true, pendingIntent: "notGoing" },
      { type: "registered", hasProfile: true, suggestion: "" },
    ]);
    expect(state).toEqual({ step: "answering", intent: "notGoing", standing: null });
  });

  it("returns to the e-mail form with the failure, and the cancelled Google window to the choice", () => {
    const open = run([
      { type: "sessionChecked", signedIn: false, pendingIntent: null },
      { type: "answerTapped", intent: "going" },
    ]);
    expect(
      run(
        [
          { type: "formChosen", form: "signIn" },
          { type: "signInStarted", attempt: "signIn" },
          { type: "signInFailed", failure: { kind: "invalidCredentials" } },
        ],
        open,
      ),
    ).toEqual({
      step: "signIn",
      intent: "going",
      form: "signIn",
      failure: { kind: "invalidCredentials" },
      notice: null,
    });
    expect(
      run([{ type: "signInStarted", attempt: "google" }, { type: "signInCancelled" }], open),
    ).toEqual({
      step: "signIn",
      intent: "going",
      form: "choice",
      failure: null,
      notice: null,
    });
  });

  it("says the reset link was sent and goes back to signing in", () => {
    const state = run([
      { type: "sessionChecked", signedIn: false, pendingIntent: null },
      { type: "answerTapped", intent: "going" },
      { type: "formChosen", form: "reset" },
      { type: "signInStarted", attempt: "reset" },
      { type: "resetSent" },
    ]);
    expect(state).toEqual({
      step: "signIn",
      intent: "going",
      form: "signIn",
      failure: null,
      notice: "resetSent",
    });
  });

  it("a 410 on POST /v1/me leaves the page signed out with the deleted account", () => {
    const state = run([
      { type: "sessionChecked", signedIn: true, pendingIntent: "going" },
      { type: "registrationFailed", failure: { kind: "accountDeleted" } },
    ]);
    expect(state).toEqual({ ...signedOutIdle, failure: { kind: "accountDeleted" } });
  });

  it("a 429 or a removal keeps the standing and shows the failure", () => {
    const idle: RoundPageState = {
      step: "idle",
      signedIn: true,
      nicknameSuggestion: null,
      standing: going,
      failure: null,
    };
    const limited = run(
      [
        { type: "answerTapped", intent: "notGoing" },
        { type: "answerFailed", failure: { kind: "rateLimited", retryAfterSeconds: 7 } },
      ],
      idle,
    );
    expect(limited).toEqual({ ...idle, failure: { kind: "rateLimited", retryAfterSeconds: 7 } });
    const removed = run(
      [
        { type: "answerTapped", intent: "going" },
        { type: "answerFailed", failure: { kind: "removed" } },
      ],
      idle,
    );
    expect(removed).toEqual({ ...idle, failure: { kind: "removed" } });
  });

  it("asks the nickname on the tap of whoever signed in without a profile, and keeps the text on a refusal", () => {
    const idle: RoundPageState = {
      step: "idle",
      signedIn: true,
      nicknameSuggestion: "Bia",
      standing: null,
      failure: null,
    };
    const refused = run(
      [
        { type: "answerTapped", intent: "going" },
        { type: "nicknameSubmitted", nickname: "B​ia" },
        { type: "nicknameRejected", failure: { kind: "nicknameInvalid" } },
      ],
      idle,
    );
    expect(refused).toEqual({
      step: "nickname",
      intent: "going",
      suggestion: "B​ia",
      failure: { kind: "nicknameInvalid" },
    });
    expect(run([{ type: "sheetClosed" }], refused)).toEqual({
      ...idle,
      nicknameSuggestion: "B​ia",
    });
  });

  it("closing the sheet signs nobody in", () => {
    expect(
      run([
        { type: "sessionChecked", signedIn: false, pendingIntent: null },
        { type: "answerTapped", intent: "going" },
        { type: "sheetClosed" },
      ]),
    ).toEqual(signedOutIdle);
  });

  it("ignores a late answer that does not fit the step", () => {
    expect(run([{ type: "answered", standing: going }], signedOutIdle)).toBe(signedOutIdle);
    expect(run([{ type: "signedIn" }], signedOutIdle)).toBe(signedOutIdle);
    expect(run([{ type: "registered", hasProfile: true, suggestion: "" }], signedOutIdle)).toBe(
      signedOutIdle,
    );
    expect(run([{ type: "standingLoaded", standing: going }], signedOutIdle)).toBe(signedOutIdle);
    expect(run([{ type: "nicknameSaved" }], signedOutIdle)).toBe(signedOutIdle);
  });

  it("signing out from anywhere idles signed out", () => {
    const answering: RoundPageState = { step: "answering", intent: "going", standing: going };
    expect(run([{ type: "signedOut" }], answering)).toEqual(signedOutIdle);
  });
});
