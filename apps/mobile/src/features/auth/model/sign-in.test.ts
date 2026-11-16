import { describe, expect, test } from "vitest";

import { createFakeAuthSession } from "../../../adapters/fake-auth-session";
import { strings } from "../../../strings/pt-BR";
import { authFailureText, signOutReasonText } from "./auth-failure-text";
import {
  emailSignInReducer,
  initialEmailSignInState,
  type EmailSignInAction,
  type EmailSignInState,
} from "./email-sign-in.reducer";
import {
  canSubmit,
  MAX_EMAIL_LENGTH,
  normalizedEmail,
  passwordTooShort,
  showsEmailError,
} from "./email-sign-in.selectors";
import { wordsOf } from "./legal-words";
import {
  initialSignInState,
  isBusy,
  signInReducer,
  type SignInAction,
} from "./sign-in.reducer";

const { auth } = strings;
const DOMAIN = "@x.com";

function emailState(...actions: readonly EmailSignInAction[]): EmailSignInState {
  return actions.reduce(emailSignInReducer, initialEmailSignInState);
}

function addressOf(length: number): string {
  return `${"a".repeat(length - DOMAIN.length)}${DOMAIN}`;
}

describe("screen 02 reducer", () => {
  test("a login pending turns every other way in off", () => {
    const pending = signInReducer(initialSignInState, { type: "started", provider: "google" });
    expect(pending.pending).toBe("google");
    expect(signInReducer(pending, { type: "started", provider: "apple" })).toBe(pending);
    expect(signInReducer(pending, { type: "email-opened" })).toBe(pending);
  });

  test("a cancel comes back without a text; a failure keeps its kind", () => {
    const pending = signInReducer(initialSignInState, { type: "started", provider: "google" });
    expect(signInReducer(pending, { type: "failed", failure: "cancelled" })).toEqual(
      initialSignInState,
    );
    const failed = signInReducer(pending, { type: "failed", failure: "offline" });
    expect(failed).toEqual({ pending: null, failure: "offline", emailOpen: false });
    expect(signInReducer(failed, { type: "dismissed" }).failure).toBeNull();
    expect(signInReducer(failed, { type: "started", provider: "google" }).failure).toBeNull();
  });

  test("success clears the pending login; the e-mail sheet opens and closes", () => {
    const pending = signInReducer(initialSignInState, { type: "started", provider: "google" });
    expect(signInReducer(pending, { type: "succeeded" })).toEqual(initialSignInState);
    const open = signInReducer(initialSignInState, { type: "email-opened" });
    expect(open.emailOpen).toBe(true);
    expect(signInReducer(open, { type: "started", provider: "google" })).toBe(open);
    expect(signInReducer(open, { type: "email-closed" }).emailOpen).toBe(false);
  });

  test("the switch is exhaustive", () => {
    // @ts-expect-error: an action the reducer does not know does not compile.
    const unknown: SignInAction = { type: "teleported" };
    expect(unknown.type).toBe("teleported");
  });
});

describe("e-mail sheet reducer and selectors", () => {
  test("the e-mail is trimmed, the password never is", () => {
    const state = emailState(
      { type: "email-changed", text: " ana@x.com " },
      { type: "password-changed", text: "segredo " },
    );
    expect(normalizedEmail(state)).toBe("ana@x.com");
    expect(state.password).toBe("segredo ");
    expect(canSubmit(state)).toBe(true);
  });

  test.each(["ana@", "a b@x.com", "ana@x", addressOf(MAX_EMAIL_LENGTH + 1)])(
    "%s is refused",
    (email) => {
      const state = emailState(
        { type: "email-changed", text: email },
        { type: "password-changed", text: "123456" },
      );
      expect(showsEmailError(state)).toBe(true);
      expect(canSubmit(state)).toBe(false);
    },
  );

  test("254 characters are accepted", () => {
    const state = emailState({ type: "email-changed", text: addressOf(MAX_EMAIL_LENGTH) });
    expect(showsEmailError(state)).toBe(false);
  });

  test("an empty e-mail is not a refusal yet", () => {
    expect(showsEmailError(initialEmailSignInState)).toBe(false);
    expect(canSubmit(initialEmailSignInState)).toBe(false);
  });

  test("creating an account needs 6 characters; signing in does not check", () => {
    const five = emailState(
      { type: "mode-changed", mode: "signUp" },
      { type: "email-changed", text: "ana@x.com" },
      { type: "password-changed", text: "12345" },
    );
    expect(passwordTooShort(five)).toBe(true);
    expect(canSubmit(five)).toBe(false);
    const six = emailSignInReducer(five, { type: "password-changed", text: "123456" });
    expect(passwordTooShort(six)).toBe(false);
    expect(canSubmit(six)).toBe(true);
    const signIn = emailSignInReducer(five, { type: "mode-changed", mode: "signIn" });
    const short = emailSignInReducer(signIn, { type: "password-changed", text: "1" });
    expect(passwordTooShort(short)).toBe(false);
    expect(canSubmit(short)).toBe(true);
  });

  test("a refused credential empties the password and keeps the e-mail", () => {
    const sent = emailState(
      { type: "email-changed", text: "ana@x.com" },
      { type: "password-changed", text: "errada" },
      { type: "submitted" },
    );
    expect(canSubmit(sent)).toBe(false);
    expect(emailSignInReducer(sent, { type: "submitted" })).toBe(sent);
    const refused = emailSignInReducer(sent, {
      type: "failed",
      mode: "signIn",
      failure: "invalid-credentials",
    });
    expect(refused).toMatchObject({ email: "ana@x.com", password: "", submitting: false });
    expect(authFailureText(refused.failure)).toBe("E-mail ou senha incorretos.");
    const offline = emailSignInReducer(sent, { type: "failed", mode: "signIn", failure: "offline" });
    expect(offline.password).toBe("errada");
  });

  test("closing the sheet or changing the mode forgets the password", () => {
    const typed = emailState(
      { type: "email-changed", text: "ana@x.com" },
      { type: "password-changed", text: "segredo" },
    );
    expect(emailSignInReducer(typed, { type: "closed" })).toEqual(initialEmailSignInState);
    expect(emailSignInReducer(typed, { type: "mode-changed", mode: "signUp" })).toMatchObject({
      email: "ana@x.com",
      password: "",
    });
  });

  test("the reset answers the same text for a known and an unknown e-mail", () => {
    const asked = emailState(
      { type: "mode-changed", mode: "reset" },
      { type: "email-changed", text: "ana@x.com" },
      { type: "submitted" },
    );
    const known = emailSignInReducer(asked, { type: "reset-sent", mode: "reset" });
    const unknown = emailSignInReducer(asked, {
      type: "failed",
      mode: "reset",
      failure: "invalid-credentials",
    });
    expect(unknown).toEqual(known);
    expect(known.resetSent).toBe(true);
    expect(canSubmit(known)).toBe(false);
    const offline = emailSignInReducer(asked, { type: "failed", mode: "reset", failure: "offline" });
    expect(offline.resetSent).toBe(false);
  });

  test("while a request is out the mode stays, and an answer for another mode is ignored", () => {
    const sent = emailState(
      { type: "email-changed", text: "ana@x.com" },
      { type: "password-changed", text: "segredo" },
      { type: "submitted" },
    );
    expect(emailSignInReducer(sent, { type: "mode-changed", mode: "reset" })).toBe(sent);
    const reset = emailState(
      { type: "mode-changed", mode: "reset" },
      { type: "email-changed", text: "ana@x.com" },
    );
    const late = emailSignInReducer(reset, {
      type: "failed",
      mode: "signIn",
      failure: "invalid-credentials",
    });
    expect(late).toBe(reset);
    expect(emailSignInReducer(reset, { type: "reset-sent", mode: "signIn" })).toBe(reset);
  });

  test("the terms sentence breaks between words", () => {
    expect(wordsOf("Ao entrar você aceita os ")).toEqual(["Ao ", "entrar ", "você ", "aceita ", "os "]);
    expect(wordsOf(" e a ")).toEqual([" e ", "a "]);
    expect(wordsOf(".")).toEqual(["."]);
    expect(wordsOf(" ")).toEqual([" "]);
    expect(wordsOf("")).toEqual([]);
  });

  test("busy: a pending login or the open sheet", () => {
    expect(isBusy(initialSignInState)).toBe(false);
    expect(isBusy({ ...initialSignInState, pending: "google" })).toBe(true);
    expect(isBusy({ ...initialSignInState, emailOpen: true })).toBe(true);
  });

  test("texts of the refusals; a cancel says nothing", () => {
    expect(authFailureText("email-unavailable")).toBe(auth.failures["email-unavailable"]);
    expect(authFailureText("cancelled")).toBeNull();
    expect(authFailureText(null)).toBeNull();
  });

  test("the switch is exhaustive", () => {
    // @ts-expect-error: an action the reducer does not know does not compile.
    const unknown: EmailSignInAction = { type: "teleported" };
    expect(unknown.type).toBe("teleported");
  });
});

describe("why the login shows", () => {
  test("an expired or deleted session has its line; a plain sign-out has none", () => {
    expect(signOutReasonText({ status: "signedOut", reason: "expired" })).toBe(
      "Sua sessão acabou. Entre de novo.",
    );
    expect(signOutReasonText({ status: "signedOut", reason: "deleted" })).toBe(
      auth.reasons.deleted,
    );
    expect(signOutReasonText({ status: "signedOut", reason: "signedOut" })).toBeNull();
    expect(signOutReasonText({ status: "signedOut", reason: null })).toBeNull();
    expect(signOutReasonText({ status: "unknown" })).toBeNull();
  });

  test("the providers of the build: no Apple on Android, Google only with its client ID", () => {
    const android = createFakeAuthSession();
    expect(android.supports("apple")).toBe(false);
    expect(android.supports("google")).toBe(true);
    const noGoogle = createFakeAuthSession({ supported: ["password"] });
    expect(noGoogle.supports("google")).toBe(false);
    expect(noGoogle.supports("password")).toBe(true);
  });
});
