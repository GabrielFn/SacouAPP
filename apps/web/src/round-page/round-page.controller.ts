import { firstNameOf } from "./browser";
import type { ApiPort, AuthOutcome, AuthPort, PendingIntentStore } from "./ports";
import type { RoundPageAction } from "./round-page.actions";
import { initialRoundPageState, roundPageReducer } from "./round-page.reducer";
import type { Failure, Intent, RoundPageState, SheetForm } from "./round-page.types";
import { emailModeOf, settleSignIn, submitEmailForm } from "./sign-in-flow";

export interface RoundPageDependencies {
  /** The round link's code, read from the page; it only goes in request bodies (ADR 0070, D3). */
  readonly code: string;
  readonly auth: AuthPort;
  readonly api: ApiPort;
  readonly intents: PendingIntentStore;
  readonly nicknameMaxCodePoints: number;
  readonly onChange: (state: RoundPageState) => void;
}

/** What the view calls. Every effect lives here, outside the reducer (rule 4 of frontend.md, by analogy). */
export interface RoundPage {
  readonly state: () => RoundPageState;
  start(): Promise<void>;
  tapAnswer(intent: Intent): Promise<void>;
  /** The answer to "Sair da lista?": send the "NÃO VOU MAIS", or stay on the list. */
  confirmLeave(): Promise<void>;
  keepPlace(): Promise<void>;
  closeSheet(): void;
  chooseForm(form: SheetForm): void;
  signInWithGoogle(): Promise<void>;
  submitEmail(email: string, password: string): Promise<void>;
  submitNickname(nickname: string): Promise<void>;
  signOut(): Promise<void>;
}

/** A blocked window that the redirect could not get past either. */
const UNEXPECTED: Failure = { kind: "unexpected" };

/** The page's flow: the reducer holds the state, and each step that talks to Firebase or the API runs here. */
export function createRoundPage(deps: RoundPageDependencies): RoundPage {
  const store = { current: initialRoundPageState };

  async function dispatch(action: RoundPageAction): Promise<void> {
    const before = store.current;
    store.current = roundPageReducer(before, action);
    if (store.current === before) return;
    deps.onChange(store.current);
    await follow(store.current);
  }

  /** The steps that are a request: entering one starts it. */
  async function follow(state: RoundPageState): Promise<void> {
    if (state.step === "registering") await register();
    else if (state.step === "savingNickname") await saveNickname(state.nickname);
    else if (state.step === "answering") await answer(state.intent);
  }

  async function register(): Promise<void> {
    const outcome = await deps.api.register();
    if (!outcome.ok) {
      // The browser keeps no session the API refuses (a deleted account, no connection to the Sacou).
      await deps.auth.signOut();
      await dispatch({ type: "registrationFailed", failure: outcome.failure });
      return;
    }
    // Without an intent (a returning visitor), the page shows where a member already stands.
    const returning = store.current.step === "registering" && store.current.intent === null;
    const suggestion = firstNameOf(
      deps.auth.currentUser()?.displayName ?? null,
      deps.nicknameMaxCodePoints,
    );
    await dispatch({ type: "registered", hasProfile: outcome.value.hasProfile, suggestion });
    if (returning) await loadStanding();
  }

  async function loadStanding(): Promise<void> {
    const outcome = await deps.api.standing(deps.code);
    if (outcome.ok) await dispatch({ type: "standingLoaded", standing: outcome.value });
  }

  async function saveNickname(nickname: string): Promise<void> {
    const outcome = await deps.api.saveNickname(nickname);
    await dispatch(
      outcome.ok
        ? { type: "nicknameSaved" }
        : { type: "nicknameRejected", failure: outcome.failure },
    );
  }

  async function answer(intent: Intent): Promise<void> {
    const outcome = await deps.api.answer(deps.code, intent);
    await dispatch(
      outcome.ok
        ? { type: "answered", standing: outcome.value }
        : { type: "answerFailed", failure: outcome.failure },
    );
  }

  const settle = (outcome: AuthOutcome) => settleSignIn(outcome, dispatch, UNEXPECTED);

  async function signInWithGoogle(): Promise<void> {
    const open = store.current;
    if (open.step !== "signIn") return;
    await dispatch({ type: "signInStarted", attempt: "google" });
    const popup = await deps.auth.signInWithGooglePopup();
    if (popup.kind !== "popupBlocked") return settle(popup);
    // The browser blocked the window: the intent waits in the session storage while the page leaves.
    deps.intents.keep(open.intent);
    return settle(await deps.auth.signInWithGoogleRedirect());
  }

  const submitEmail = (email: string, password: string) =>
    submitEmailForm(deps.auth, emailModeOf(store.current), email, password, dispatch, UNEXPECTED);

  return {
    state: () => store.current,
    start: async () => {
      const user = await deps.auth.restore();
      const pending = deps.intents.take();
      await dispatch({
        type: "sessionChecked",
        signedIn: user !== null,
        pendingIntent: user === null ? null : pending,
      });
    },
    tapAnswer: (intent) => dispatch({ type: "answerTapped", intent }),
    confirmLeave: () => dispatch({ type: "leaveConfirmed" }),
    keepPlace: () => dispatch({ type: "leaveCancelled" }),
    closeSheet: () => void dispatch({ type: "sheetClosed" }),
    chooseForm: (form) => void dispatch({ type: "formChosen", form }),
    signInWithGoogle,
    submitEmail,
    submitNickname: (nickname) =>
      dispatch({ type: "nicknameSubmitted", nickname: nickname.trim() }),
    signOut: async () => {
      await deps.auth.signOut();
      await dispatch({ type: "signedOut" });
    },
  };
}
