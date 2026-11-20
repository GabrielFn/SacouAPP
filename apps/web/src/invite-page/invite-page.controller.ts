import type { AuthOutcome, AuthPort } from "../round-page/ports";
import type { Failure, SheetForm } from "../round-page/round-page.types";
import { emailModeOf, settleSignIn, submitEmailForm } from "../round-page/sign-in-flow";

import type { InvitePageAction } from "./invite-page.actions";
import { initialInvitePageState, invitePageReducer } from "./invite-page.reducer";
import type { InvitePageState } from "./invite-page.types";
import type { InviteApiPort } from "./ports";

export interface InvitePageDependencies {
  /** The token read from the fragment, or null; it lives only here and only goes in request bodies (ADR 0040, D10). */
  readonly token: string | null;
  readonly auth: AuthPort;
  readonly api: InviteApiPort;
  readonly onChange: (state: InvitePageState) => void;
}

/** What the view calls. Every effect lives here, outside the reducer (rule 4 of frontend.md, by analogy). */
export interface InvitePage {
  readonly state: () => InvitePageState;
  start(): Promise<void>;
  tapSignIn(): Promise<void>;
  closeSheet(): void;
  chooseForm(form: SheetForm): void;
  signInWithGoogle(): Promise<void>;
  submitEmail(email: string, password: string): Promise<void>;
  join(): Promise<void>;
  signOut(): Promise<void>;
}

/** A blocked Google window: the e-mail is the way in (no redirect on this page). */
const POPUP_BLOCKED: Failure = { kind: "providerUnavailable" };

/** The invite page's flow: the reducer holds the state, and each step that talks to Firebase or the API runs here. */
export function createInvitePage(deps: InvitePageDependencies): InvitePage {
  const store = { current: initialInvitePageState };

  async function dispatch(action: InvitePageAction): Promise<void> {
    const before = store.current;
    store.current = invitePageReducer(before, action);
    if (store.current === before) return;
    deps.onChange(store.current);
    await follow(store.current);
  }

  /** The steps that are a request: entering one starts it. */
  async function follow(state: InvitePageState): Promise<void> {
    if (state.step === "previewing") await preview();
    else if (state.step === "joining") await accept();
  }

  async function preview(): Promise<void> {
    if (deps.token === null) return;
    const registered = await deps.api.register();
    const outcome = registered.ok ? await deps.api.preview(deps.token) : registered;
    if (outcome.ok) return dispatch({ type: "previewLoaded", preview: outcome.value });
    // The browser keeps no session the API refuses (a deleted account).
    if (outcome.failure.kind === "accountDeleted") await deps.auth.signOut();
    return dispatch({ type: "previewFailed", failure: outcome.failure });
  }

  async function accept(): Promise<void> {
    if (deps.token === null) return;
    const outcome = await deps.api.accept(deps.token);
    if (!outcome.ok && outcome.failure.kind === "accountDeleted") await deps.auth.signOut();
    return dispatch(
      outcome.ok ? { type: "joined" } : { type: "joinFailed", failure: outcome.failure },
    );
  }

  // No redirect here: the page would come back without the token, which lives only in memory (ADR 0070, D8).
  const settle = (outcome: AuthOutcome) => settleSignIn(outcome, dispatch, POPUP_BLOCKED);

  const submitEmail = (email: string, password: string) =>
    submitEmailForm(
      deps.auth,
      emailModeOf(store.current),
      email,
      password,
      dispatch,
      POPUP_BLOCKED,
    );

  return {
    state: () => store.current,
    start: async () => {
      if (deps.token === null) return dispatch({ type: "tokenRejected" });
      const user = await deps.auth.restore();
      return dispatch({ type: "sessionChecked", signedIn: user !== null });
    },
    tapSignIn: () => dispatch({ type: "signInTapped" }),
    closeSheet: () => void dispatch({ type: "sheetClosed" }),
    chooseForm: (form) => void dispatch({ type: "formChosen", form }),
    signInWithGoogle: async () => {
      if (store.current.step !== "signIn") return;
      await dispatch({ type: "signInStarted", attempt: "google" });
      return settle(await deps.auth.signInWithGooglePopup());
    },
    submitEmail,
    join: () => dispatch({ type: "joinTapped" }),
    signOut: async () => {
      await deps.auth.signOut();
      await dispatch({ type: "signedOut" });
    },
  };
}
