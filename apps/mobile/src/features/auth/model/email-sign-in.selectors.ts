import type { EmailSignInState } from "./email-sign-in.reducer";

/** The longest address of the e-mail standard (RFC 5321, path limit less the brackets). */
export const MAX_EMAIL_LENGTH = 254;
/** The rule of Firebase and of the product (question 12). */
export const MIN_PASSWORD_LENGTH = 6;
/** A simple shape: something, an at sign, a domain with a dot, and no spaces. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The e-mail is trimmed; the password never is (a space can be part of it). */
export function normalizedEmail(state: EmailSignInState): string {
  return state.email.trim();
}

export function isValidEmail(email: string): boolean {
  return email.length <= MAX_EMAIL_LENGTH && EMAIL_SHAPE.test(email);
}

/** Shown only once something was typed, so an empty field is not a refusal. */
export function showsEmailError(state: EmailSignInState): boolean {
  const email = normalizedEmail(state);
  return email !== "" && !isValidEmail(email);
}

function passwordLength(state: EmailSignInState): number {
  return state.password.length;
}

/** Only creating an account checks the length; signing in sends what was typed. */
export function passwordTooShort(state: EmailSignInState): boolean {
  return state.mode === "signUp" && passwordLength(state) < MIN_PASSWORD_LENGTH;
}

export function canSubmit(state: EmailSignInState): boolean {
  if (state.submitting || !isValidEmail(normalizedEmail(state))) return false;
  if (state.mode === "reset") return !state.resetSent;
  return passwordLength(state) > 0 && !passwordTooShort(state);
}

/** The link under the button: "forgot" when signing in, "back" when resetting, none when creating. */
export function showsModeLink(state: EmailSignInState): boolean {
  return state.mode !== "signUp";
}
