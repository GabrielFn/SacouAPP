import {
  isAnswerAction,
  isSessionAction,
  type AnswerAction,
  type RoundPageAction,
  type SessionAction,
  type SheetAction,
} from "./round-page.actions";
import type {
  Failure,
  Intent,
  RoundPageState,
  SheetForm,
  SignInSheet,
  SigningIn,
  Standing,
} from "./round-page.types";
import { holdsPlace } from "./standing";

export const initialRoundPageState: RoundPageState = { step: "starting" };

function signedOutWith(failure: Failure | null): RoundPageState {
  return { step: "idle", signedIn: false, nicknameSuggestion: null, standing: null, failure };
}

const signedOut = signedOutWith(null);

function signedInIdle(
  standing: Standing | null,
  failure: Failure | null,
  nicknameSuggestion: string | null = null,
): RoundPageState {
  return { step: "idle", signedIn: true, nicknameSuggestion, standing, failure };
}

function sheet(intent: Intent, form: SheetForm, failure: Failure | null = null): RoundPageState {
  return { step: "signIn", intent, form, failure, notice: null };
}

function when<S extends RoundPageState["step"]>(
  state: RoundPageState,
  step: S,
  change: (current: Extract<RoundPageState, { step: S }>) => RoundPageState,
): RoundPageState {
  return state.step === step ? change(state as Extract<RoundPageState, { step: S }>) : state;
}

// The session: Firebase's first answer, `POST /v1/me` and where the person stands.

function afterSessionCheck(
  state: RoundPageState,
  signedIn: boolean,
  pendingIntent: Intent | null,
): RoundPageState {
  if (state.step !== "starting") return state;
  return signedIn ? { step: "registering", intent: pendingIntent } : signedOut;
}

function afterRegistration(
  state: RoundPageState,
  hasProfile: boolean,
  suggestion: string,
): RoundPageState {
  if (state.step !== "registering") return state;
  if (state.intent === null) return signedInIdle(null, null, hasProfile ? null : suggestion);
  return hasProfile
    ? { step: "answering", intent: state.intent, standing: null }
    : { step: "nickname", intent: state.intent, suggestion, failure: null };
}

function withStanding(state: RoundPageState, standing: Standing | null): RoundPageState {
  return state.step === "idle" && state.signedIn ? { ...state, standing } : state;
}

function sessionReducer(state: RoundPageState, action: SessionAction): RoundPageState {
  switch (action.type) {
    case "sessionChecked":
      return afterSessionCheck(state, action.signedIn, action.pendingIntent);
    case "registered":
      return afterRegistration(state, action.hasProfile, action.suggestion);
    case "registrationFailed":
      return when(state, "registering", () => signedOutWith(action.failure));
    case "standingLoaded":
      return withStanding(state, action.standing);
    case "signedOut":
      return signedOut;
  }
}

// The sheet of screen 02.

function afterTap(state: RoundPageState, intent: Intent): RoundPageState {
  if (state.step !== "idle") return state;
  if (!state.signedIn) return sheet(intent, "choice");
  if (state.nicknameSuggestion !== null) {
    return { step: "nickname", intent, suggestion: state.nicknameSuggestion, failure: null };
  }
  if (intent === "notGoing" && state.standing !== null && holdsPlace(state.standing)) {
    return { step: "confirmingLeave", standing: state.standing };
  }
  return { step: "answering", intent, standing: state.standing };
}

/** Closing the sheet: signed out before the sign-in, signed in (still without a nickname) at the nickname step. */
function closed(state: RoundPageState): RoundPageState {
  if (state.step === "signIn") return signedOut;
  if (state.step === "nickname") return signedInIdle(null, null, state.suggestion);
  return state;
}

/** Back to the form the attempt came from: the Google window returns to the choice. */
function formOf(attempt: SigningIn): SheetForm {
  return attempt.attempt === "google" ? "choice" : attempt.attempt;
}

function inSheet(
  state: RoundPageState,
  change: (open: SignInSheet) => RoundPageState,
): RoundPageState {
  return when(state, "signIn", change);
}

function whileSigningIn(
  state: RoundPageState,
  change: (attempt: SigningIn) => RoundPageState,
): RoundPageState {
  return when(state, "signingIn", change);
}

function sheetReducer(state: RoundPageState, action: SheetAction): RoundPageState {
  switch (action.type) {
    case "answerTapped":
      return afterTap(state, action.intent);
    case "sheetClosed":
      return closed(state);
    case "formChosen":
      return inSheet(state, (open) => sheet(open.intent, action.form));
    case "signInStarted":
      return inSheet(state, (open) => ({
        step: "signingIn",
        intent: open.intent,
        attempt: action.attempt,
      }));
    case "signInFailed":
      return whileSigningIn(state, (attempt) =>
        sheet(attempt.intent, formOf(attempt), action.failure),
      );
    case "signInCancelled":
      return whileSigningIn(state, (attempt) => sheet(attempt.intent, formOf(attempt)));
    case "resetSent":
      return whileSigningIn(state, (attempt) => ({
        ...sheet(attempt.intent, "signIn"),
        notice: "resetSent",
      }));
    case "signedIn":
      return whileSigningIn(state, (attempt) => ({ step: "registering", intent: attempt.intent }));
  }
}

// The nickname and the answer.

function answerReducer(state: RoundPageState, action: AnswerAction): RoundPageState {
  switch (action.type) {
    case "nicknameSubmitted":
      return when(state, "nickname", (step) => ({
        step: "savingNickname",
        intent: step.intent,
        nickname: action.nickname,
      }));
    case "nicknameSaved":
      return when(state, "savingNickname", (step) => ({
        step: "answering",
        intent: step.intent,
        standing: null,
      }));
    case "nicknameRejected":
      return when(state, "savingNickname", (step) => ({
        step: "nickname",
        intent: step.intent,
        suggestion: step.nickname,
        failure: action.failure,
      }));
    case "answered":
      return when(state, "answering", () => signedInIdle(action.standing, null));
    case "answerFailed":
      return when(state, "answering", (step) => signedInIdle(step.standing, action.failure));
    case "leaveConfirmed":
      return when(state, "confirmingLeave", (step) => ({
        step: "answering",
        intent: "notGoing",
        standing: step.standing,
      }));
    case "leaveCancelled":
      return when(state, "confirmingLeave", (step) => signedInIdle(step.standing, null));
  }
}

/**
 * The page's flow, pure: no Firebase, no fetch, no DOM. An action that does not fit the current step leaves the
 * state as it is, so a late answer of a stale request changes nothing.
 */
export function roundPageReducer(state: RoundPageState, action: RoundPageAction): RoundPageState {
  if (isSessionAction(action)) return sessionReducer(state, action);
  if (isAnswerAction(action)) return answerReducer(state, action);
  return sheetReducer(state, action);
}
