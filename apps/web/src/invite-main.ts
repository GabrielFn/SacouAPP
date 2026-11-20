import "./styles/round.css";

import { createFirebaseAuth } from "./adapters/firebase-auth";
import { createInviteFetchApi } from "./adapters/invite-fetch-api";
import { readFirebaseConfig } from "./config/page-config";
import { findInviteElements, INVITE_IDS, type InviteNodes } from "./dom/invite-elements";
import { renderInvitePage } from "./dom/invite-view";
import { listenToSheet } from "./dom/sheet-listeners";
import type { ViewEnvironment } from "./dom/sign-in-sheet";
import { createInvitePage, type InvitePage } from "./invite-page/invite-page.controller";
import { takeInviteToken } from "./invite-page/invite-token";
import { isEmbeddedBrowser } from "./round-page/browser";

function listen(nodes: InviteNodes, page: InvitePage): void {
  nodes.signIn.addEventListener("click", () => void page.tapSignIn());
  nodes.join.addEventListener("click", () => void page.join());
  listenToSheet(nodes, page);
  nodes.signOut.addEventListener("click", () => void page.signOut());
}

function boot(): void {
  // First of all, before Firebase or any request: the token leaves the address bar (ADR 0070, D8).
  const token = takeInviteToken(location, history);
  const root = document.getElementById(INVITE_IDS.root);
  const firebase = root === null ? null : readFirebaseConfig(root.dataset);
  // Without the Firebase Web config the page stays as the server drew it ("abra no app").
  if (firebase === null) return;
  const nodes = findInviteElements(document);
  const environment: ViewEnvironment = { embedded: isEmbeddedBrowser(navigator.userAgent) };
  const auth = createFirebaseAuth(firebase);
  const page = createInvitePage({
    token,
    auth,
    api: createInviteFetchApi({
      fetch: (input, init) => fetch(input, init),
      idToken: () => auth.idToken(),
    }),
    onChange: (state) => {
      renderInvitePage(nodes, state, environment);
      if (state.step === "signIn" && document.activeElement === nodes.signIn) {
        nodes.sheetClose.focus();
      }
    },
  });
  listen(nodes, page);
  renderInvitePage(nodes, page.state(), environment);
  void page.start();
}

boot();
