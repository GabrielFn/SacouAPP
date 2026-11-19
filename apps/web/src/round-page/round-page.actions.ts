import type { Failure, Intent, SheetForm, SignInAttempt, Standing } from "./round-page.types";

/** Everything that moves the page's flow. A union on `type`, so the reducer's switch is exhaustive. */
export type RoundPageAction =
  /** The first answer of Firebase about this browser, and the intent kept across a Google redirect. */
  | { readonly type: "sessionChecked"; readonly signedIn: boolean; readonly pendingIntent: Intent | null }
  | { readonly type: "answerTapped"; readonly intent: Intent }
  | { readonly type: "sheetClosed" }
  | { readonly type: "formChosen"; readonly form: SheetForm }
  | { readonly type: "signInStarted"; readonly attempt: SignInAttempt }
  | { readonly type: "signInFailed"; readonly failure: Failure }
  /** The person closed the Google window: back to the sheet, with nothing to explain. */
  | { readonly type: "signInCancelled" }
  | { readonly type: "resetSent" }
  | { readonly type: "signedIn" }
  /** `POST /v1/me` passed; `suggestion` is the provider's first name, offered when there is no profile. */
  | { readonly type: "registered"; readonly hasProfile: boolean; readonly suggestion: string }
  | { readonly type: "registrationFailed"; readonly failure: Failure }
  | { readonly type: "standingLoaded"; readonly standing: Standing | null }
  | { readonly type: "nicknameSubmitted"; readonly nickname: string }
  | { readonly type: "nicknameSaved" }
  | { readonly type: "nicknameRejected"; readonly failure: Failure }
  | { readonly type: "answered"; readonly standing: Standing }
  | { readonly type: "answerFailed"; readonly failure: Failure }
  | { readonly type: "signedOut" };
