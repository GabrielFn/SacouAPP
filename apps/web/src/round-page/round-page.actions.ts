import type { Failure, Intent, Standing } from "./round-page.types";
import type { SignInSheetAction } from "./sign-in-flow";

/** Firebase and `POST /v1/me`: who is signed in, and what the API knows of them. */
export type SessionAction =
  /** The first answer of Firebase about this browser, and the intent kept across a Google redirect. */
  | {
      readonly type: "sessionChecked";
      readonly signedIn: boolean;
      readonly pendingIntent: Intent | null;
    }
  /** `POST /v1/me` passed; `suggestion` is the provider's first name, offered when there is no profile. */
  | { readonly type: "registered"; readonly hasProfile: boolean; readonly suggestion: string }
  | { readonly type: "registrationFailed"; readonly failure: Failure }
  | { readonly type: "standingLoaded"; readonly standing: Standing | null }
  | { readonly type: "signedOut" };

/** The sheet of screen 02: the two ways in, the e-mail form and the Google window. */
export type SheetAction =
  { readonly type: "answerTapped"; readonly intent: Intent } | SignInSheetAction;

/** The nickname (question 129) and the answer itself. */
export type AnswerAction =
  | { readonly type: "nicknameSubmitted"; readonly nickname: string }
  | { readonly type: "nicknameSaved" }
  | { readonly type: "nicknameRejected"; readonly failure: Failure }
  | { readonly type: "answered"; readonly standing: Standing }
  | { readonly type: "answerFailed"; readonly failure: Failure };

/** Everything that moves the page's flow: unions on `type`, so each reducer's switch is exhaustive. */
export type RoundPageAction = SessionAction | SheetAction | AnswerAction;

const SESSION_TYPES: ReadonlySet<string> = new Set<SessionAction["type"]>([
  "sessionChecked",
  "registered",
  "registrationFailed",
  "standingLoaded",
  "signedOut",
]);

const ANSWER_TYPES: ReadonlySet<string> = new Set<AnswerAction["type"]>([
  "nicknameSubmitted",
  "nicknameSaved",
  "nicknameRejected",
  "answered",
  "answerFailed",
]);

export function isSessionAction(action: RoundPageAction): action is SessionAction {
  return SESSION_TYPES.has(action.type);
}

export function isAnswerAction(action: RoundPageAction): action is AnswerAction {
  return ANSWER_TYPES.has(action.type);
}
