import "./styles/round.css";

import { createFetchApi } from "./adapters/fetch-api";
import { createFirebaseAuth } from "./adapters/firebase-auth";
import { createSessionIntentStore } from "./adapters/session-intent-store";
import { readPageConfig } from "./config/page-config";
import { ELEMENT_IDS, findPageElements, type PageNodes } from "./dom/page-elements";
import { renderRoundPage, type RoundViewEnvironment } from "./dom/round-view";
import { listenToSheet } from "./dom/sheet-listeners";
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
  if (after.step === "confirmingLeave") {
    // The answers vanish with the question: the focus goes to the safe answer, "CONTINUAR NA LISTA".
    nodes.leaveKeep?.focus();
  } else if (after.step === "nickname") {
    nodes.nickname.value = after.suggestion;
    nodes.nickname.focus();
  } else if (after.step === "signIn" && before !== "signingIn") {
    nodes.sheetClose.focus();
  }
}

function listen(nodes: PageNodes, page: RoundPage): void {
  nodes.going?.addEventListener("click", () => void page.tapAnswer("going"));
  nodes.notGoing?.addEventListener("click", () => void page.tapAnswer("notGoing"));
  nodes.leaveYes?.addEventListener("click", () => void page.confirmLeave());
  nodes.leaveKeep?.addEventListener("click", () => void page.keepPlace());
  listenToSheet(nodes, page);
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
  const environment: RoundViewEnvironment = {
    embedded: isEmbeddedBrowser(navigator.userAgent),
    dropIn: config.dropIn,
  };
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
