import type { AuthOutcome, AuthPort } from "../round-page/ports";
import type { Failure, SheetForm } from "../round-page/round-page.types";
import { emailModeOf, settleSignIn, submitEmailForm } from "../round-page/sign-in-flow";

import type { OpsPageAction } from "./ops-page.actions";
import { initialOpsPageState, opsPageReducer } from "./ops-page.reducer";
import type { OpsPageState } from "./ops-page.types";
import type { OpsApiPort, OpsOutcome } from "./ports";

export interface OpsPageDependencies {
  readonly auth: AuthPort;
  readonly api: OpsApiPort;
  readonly onChange: (state: OpsPageState) => void;
}

/** What the view calls. Every effect lives here, outside the reducer. */
export interface OpsPage {
  readonly state: () => OpsPageState;
  start(): Promise<void>;
  tapSignIn(): void;
  closeSheet(): void;
  chooseForm(form: SheetForm): void;
  signInWithGoogle(): Promise<void>;
  submitEmail(email: string, password: string): Promise<void>;
  /** "Atualizar" and "Tentar de novo". */
  reload(): Promise<void>;
  signOut(): Promise<void>;
}

/** A blocked Google window: the e-mail is the way in. */
const POPUP_BLOCKED: Failure = { kind: "providerUnavailable" };

function actionOf(outcome: OpsOutcome): OpsPageAction {
  switch (outcome.kind) {
    case "ok":
      return { type: "loaded", metrics: outcome.metrics };
    case "denied":
      return { type: "denied" };
    case "signedOut":
      return { type: "unauthorized" };
    case "failed":
      return { type: "loadFailed", failure: outcome.failure };
  }
}

/** The sheet's open form as the shared e-mail flow reads it (a closed sheet has none). */
function openForm(state: OpsPageState): { readonly step: string; readonly form?: SheetForm } {
  return state.step === "signIn" && state.form !== null
    ? { step: state.step, form: state.form }
    : { step: state.step };
}

/** The dashboard's flow: the reducer holds the state, and each request to Firebase or the API runs here. */
export function createOpsPage(deps: OpsPageDependencies): OpsPage {
  const store = { current: initialOpsPageState };
  const requests = { current: 0 };

  async function dispatch(action: OpsPageAction): Promise<void> {
    const before = store.current;
    store.current = opsPageReducer(before, action);
    if (store.current === before) return;
    deps.onChange(store.current);
    if (store.current.step === "loading") await load();
  }

  /**
   * Each request has its number; leaving the session starts a new one. An answer of an older request (another account,
   * or one before "Sair") is dropped, so the numbers of one account never land on another's screen.
   */
  async function load(): Promise<void> {
    requests.current += 1;
    const request = requests.current;
    const outcome = await deps.api.metrics();
    if (request !== requests.current) return;
    if (outcome.kind === "signedOut") await deps.auth.signOut();
    await dispatch(actionOf(outcome));
  }

  /** The sheet's taps: no request behind them, so nobody waits for them. */
  function tap(action: OpsPageAction): void {
    void dispatch(action);
  }

  /** The Google window, only from the open sheet; a blocked one points to the e-mail. */
  async function google(): Promise<void> {
    if (store.current.step !== "signIn") return;
    await dispatch({ type: "signInStarted", attempt: "google" });
    const outcome: AuthOutcome = await deps.auth.signInWithGooglePopup();
    await settleSignIn(outcome, dispatch, POPUP_BLOCKED);
  }

  return {
    state: () => store.current,
    start: async () => {
      const user = await deps.auth.restore();
      return dispatch({ type: "sessionChecked", signedIn: user !== null });
    },
    tapSignIn: () => {
      tap({ type: "signInTapped" });
    },
    closeSheet: () => {
      tap({ type: "sheetClosed" });
    },
    chooseForm: (form) => {
      tap({ type: "formChosen", form });
    },
    signInWithGoogle: google,
    submitEmail: (email, password) =>
      submitEmailForm(
        deps.auth,
        emailModeOf(openForm(store.current)),
        email,
        password,
        dispatch,
        POPUP_BLOCKED,
      ),
    reload: () => dispatch({ type: "reloadTapped" }),
    signOut: async () => {
      requests.current += 1;
      await deps.auth.signOut();
      await dispatch({ type: "signedOut" });
    },
  };
}
