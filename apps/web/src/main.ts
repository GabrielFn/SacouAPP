import "./styles/round.css";

import { createFetchApi } from "./adapters/fetch-api";
import { createFirebaseAuth } from "./adapters/firebase-auth";
import { createSessionIntentStore } from "./adapters/session-intent-store";
import { readPageConfig } from "./config/page-config";
import { ELEMENT_IDS, findPageElements, type PageNodes } from "./dom/page-elements";
import { renderRoundPage, type ViewEnvironment } from "./dom/round-view";
import { isEmbeddedBrowser } from "./round-page/browser";
import { createRoundPage, type RoundPage } from "./round-page/round-page.controller";
import type { RoundPageState } from "./round-page/round-page.types";

/** On entering the nickname step, the field starts with the suggestion; afterwards it is the person's text. */
function onStepChange(
  nodes: PageNodes,
  before: RoundPageState["step"],
  after: RoundPageState,
): void {
  if (after.step === before) return;
  if (after.step === "nickname") {
    nodes.nickname.value = after.suggestion;
    nodes.nickname.focus();
  } else if (after.step === "signIn" && before !== "signingIn") {
    nodes.sheetClose.focus();
  }
}

function listen(nodes: PageNodes, page: RoundPage): void {
  nodes.going?.addEventListener("click", () => void page.tapAnswer("going"));
  nodes.notGoing?.addEventListener("click", () => void page.tapAnswer("notGoing"));
  nodes.sheetClose.addEventListener("click", () => {
    page.closeSheet();
  });
  nodes.google.addEventListener("click", () => void page.signInWithGoogle());
  nodes.emailChoice.addEventListener("click", () => {
    page.chooseForm("signIn");
  });
  nodes.signInTab.addEventListener("click", () => {
    page.chooseForm("signIn");
  });
  nodes.signUpTab.addEventListener("click", () => {
    page.chooseForm("signUp");
  });
  nodes.forgot.addEventListener("click", () => {
    page.chooseForm("reset");
  });
  nodes.emailBack.addEventListener("click", () => {
    page.chooseForm("choice");
  });
  nodes.emailForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void page.submitEmail(nodes.email.value.trim(), nodes.password.value);
  });
  nodes.nicknameForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void page.submitNickname(nodes.nickname.value);
  });
  nodes.signOut.addEventListener("click", () => void page.signOut());
}

function boot(): void {
  const root = document.getElementById(ELEMENT_IDS.root);
  const config = root === null ? null : readPageConfig(root.dataset);
  // Without the config (a machine without the Firebase Web config) the page stays as the server drew it: read-only.
  if (config === null) return;
  const nodes = findPageElements(document);
  const environment: ViewEnvironment = { embedded: isEmbeddedBrowser(navigator.userAgent) };
  const auth = createFirebaseAuth(config.firebase);
  const previous = { current: "starting" as RoundPageState["step"] };
  const page = createRoundPage({
    code: config.code,
    auth,
    api: createFetchApi({
      fetch: (input, init) => fetch(input, init),
      idToken: () => auth.idToken(),
    }),
    intents: createSessionIntentStore(sessionStorage),
    nicknameMaxCodePoints: config.nicknameMaxCodePoints,
    onChange: (state) => {
      renderRoundPage(nodes, state, environment);
      onStepChange(nodes, previous.current, state);
      previous.current = state.step;
    },
  });
  listen(nodes, page);
  renderRoundPage(nodes, page.state(), environment);
  void page.start();
}

boot();
