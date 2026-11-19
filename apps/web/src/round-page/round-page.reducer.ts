import type { RoundPageAction } from "./round-page.actions";
import type {
  Failure,
  Intent,
  RoundPageState,
  SheetForm,
  SignInSheet,
  SigningIn,
  Standing,
} from "./round-page.types";

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

function afterTap(state: RoundPageState, intent: Intent): RoundPageState {
  if (state.step !== "idle") return state;
  if (!state.signedIn) return sheet(intent, "choice");
  if (state.nicknameSuggestion !== null) {
    return { step: "nickname", intent, suggestion: state.nicknameSuggestion, failure: null };
  }
  return { step: "answering", intent, standing: state.standing };
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

function inSheet(state: RoundPageState, change: (open: SignInSheet) => RoundPageState): RoundPageState {
  return state.step === "signIn" ? change(state) : state;
}

function whileSigningIn(
  state: RoundPageState,
  change: (attempt: SigningIn) => RoundPageState,
): RoundPageState {
  return state.step === "signingIn" ? change(state) : state;
}

/** Back to the form the attempt came from: the Google window returns to the choice. */
function formOf(attempt: SigningIn): SheetForm {
  return attempt.attempt === "google" ? "choice" : attempt.attempt;
}

/** Closing the sheet: signed out before the sign-in, signed in (still without a nickname) at the nickname step. */
function closed(state: RoundPageState): RoundPageState {
  if (state.step === "signIn") return signedOut;
  if (state.step === "nickname") return signedInIdle(null, null, state.suggestion);
  return state;
}

function nicknameStep(state: RoundPageState, action: RoundPageAction): RoundPageState {
  if (action.type === "nicknameSubmitted" && state.step === "nickname") {
    return { step: "savingNickname", intent: state.intent, nickname: action.nickname };
  }
  if (action.type === "nicknameSaved" && state.step === "savingNickname") {
    return { step: "answering", intent: state.intent, standing: null };
  }
  if (action.type === "nicknameRejected" && state.step === "savingNickname") {
    return { step: "nickname", intent: state.intent, suggestion: state.nickname, failure: action.failure };
  }
  return state;
}

/**
 * The page's flow, pure: no Firebase, no fetch, no DOM. An action that does not fit the current step leaves the
 * state as it is, so a late answer of a stale request changes nothing.
 */
export function roundPageReducer(state: RoundPageState, action: RoundPageAction): RoundPageState {
  switch (action.type) {
    case "sessionChecked":
      if (state.step !== "starting") return state;
      return action.signedIn ? { step: "registering", intent: action.pendingIntent } : signedOut;
    case "answerTapped":
      return afterTap(state, action.intent);
    case "sheetClosed":
      return closed(state);
    case "formChosen":
      return inSheet(state, (open) => sheet(open.intent, action.form));
    case "signInStarted":
      return inSheet(state, (open) => ({ step: "signingIn", intent: open.intent, attempt: action.attempt }));
    case "signInFailed":
      return whileSigningIn(state, (attempt) => sheet(attempt.intent, formOf(attempt), action.failure));
    case "signInCancelled":
      return whileSigningIn(state, (attempt) => sheet(attempt.intent, formOf(attempt)));
    case "resetSent":
      return whileSigningIn(state, (attempt) => ({ ...sheet(attempt.intent, "signIn"), notice: "resetSent" }));
    case "signedIn":
      return whileSigningIn(state, (attempt) => ({ step: "registering", intent: attempt.intent }));
    case "registered":
      return afterRegistration(state, action.hasProfile, action.suggestion);
    case "registrationFailed":
      return state.step === "registering" ? signedOutWith(action.failure) : state;
    case "standingLoaded":
      return state.step === "idle" && state.signedIn ? { ...state, standing: action.standing } : state;
    case "nicknameSubmitted":
    case "nicknameSaved":
    case "nicknameRejected":
      return nicknameStep(state, action);
    case "answered":
      return state.step === "answering" ? signedInIdle(action.standing, null) : state;
    case "answerFailed":
      return state.step === "answering" ? signedInIdle(state.standing, action.failure) : state;
    case "signedOut":
      return signedOut;
  }
}
