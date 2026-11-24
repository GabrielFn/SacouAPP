/** What the visitor asked for on screen 01: kept in memory (and in the session storage across the Google redirect), never in the URL. */
export type Intent = "going" | "notGoing";

/** The statuses of the API (`AttendanceStatus`). */
export type AttendanceStatus = "going" | "notGoing" | "waitlisted" | "promoted";

/** Where the visitor stands in the round, from the API: nothing is guessed on the page. */
export interface Standing {
  readonly status: AttendanceStatus;
  readonly position: number | null;
}

/** What the e-mail form asks Firebase: enter an account, make one, or send the reset link. */
export type EmailMode = "signIn" | "signUp" | "reset";

/** What the sheet shows: the two ways in (screen 02), or one mode of the e-mail form. */
export type SheetForm = "choice" | EmailMode;

/** What is running with Firebase: the Google window, or one mode of the e-mail form. */
export type SignInAttempt = "google" | EmailMode;

/** Every failure the page explains. Closed, so the texts and the reducer cover each one. */
export type Failure =
  | { readonly kind: "offline" }
  | { readonly kind: "rateLimited"; readonly retryAfterSeconds: number }
  | { readonly kind: "linkInvalid" }
  /** The invite of `/c`: revoked, expired, unknown and malformed alike (ADR 0040, D10). */
  | { readonly kind: "inviteInvalid" }
  | { readonly kind: "roundClosed" }
  | { readonly kind: "removed" }
  | { readonly kind: "groupFull" }
  | { readonly kind: "accountDeleted" }
  | { readonly kind: "nicknameInvalid" }
  | { readonly kind: "dropInWindowClosed"; readonly joined: boolean }
  | { readonly kind: "roundFull"; readonly joined: boolean }
  | { readonly kind: "invalidCredentials" }
  | { readonly kind: "emailUnavailable" }
  | { readonly kind: "weakPassword" }
  | { readonly kind: "tooManySignIns" }
  | { readonly kind: "providerUnavailable" }
  | { readonly kind: "unexpected" };

export type FailureKind = Failure["kind"];

/** A message that is no failure: the reset link was sent (the same text whether the account exists or not). */
export type Notice = "resetSent";

/**
 * The page's flow (screen 01, then the sheet of screen 02). Each step keeps only what cannot be derived:
 * the intent survives the sign-in, the registration and the nickname, so "NÃO VOU" stays "NÃO VOU".
 */
export type RoundPageState =
  | { readonly step: "starting" }
  | {
      readonly step: "idle";
      readonly signedIn: boolean;
      /** The first name to offer when the signed-in person has no profile yet; null when they have one (question 129). */
      readonly nicknameSuggestion: string | null;
      readonly standing: Standing | null;
      readonly failure: Failure | null;
    }
  | {
      readonly step: "signIn";
      readonly intent: Intent;
      readonly form: SheetForm;
      readonly failure: Failure | null;
      readonly notice: Notice | null;
    }
  | { readonly step: "signingIn"; readonly intent: Intent; readonly attempt: SignInAttempt }
  | { readonly step: "registering"; readonly intent: Intent | null }
  | {
      readonly step: "nickname";
      readonly intent: Intent;
      readonly suggestion: string;
      readonly failure: Failure | null;
    }
  | { readonly step: "savingNickname"; readonly intent: Intent; readonly nickname: string }
  | { readonly step: "answering"; readonly intent: Intent; readonly standing: Standing | null }
  /** "NÃO VOU MAIS" asked "Sair da lista?" and waits for the answer; nothing was sent (R101, item 3b). */
  | { readonly step: "confirmingLeave"; readonly standing: Standing };

export type Step = RoundPageState["step"];

export type SignInSheet = Extract<RoundPageState, { step: "signIn" }>;

export type SigningIn = Extract<RoundPageState, { step: "signingIn" }>;
