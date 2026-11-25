import "./styles/round.css";
import "./styles/ops.css";

import { createFirebaseAuth } from "./adapters/firebase-auth";
import { createOpsFetchApi } from "./adapters/ops-fetch-api";
import { readFirebaseConfig } from "./config/page-config";
import { findOpsElements, OPS_IDS, type OpsNodes } from "./dom/ops-elements";
import { renderOpsPage } from "./dom/ops-view";
import { listenToSheet } from "./dom/sheet-listeners";
import type { ViewEnvironment } from "./dom/sign-in-sheet";
import { createOpsPage, type OpsPage } from "./ops-page/ops-page.controller";
import { isEmbeddedBrowser } from "./round-page/browser";

function listen(nodes: OpsNodes, page: OpsPage): void {
  nodes.signIn.addEventListener("click", () => {
    page.tapSignIn();
  });
  nodes.reload.addEventListener("click", () => void page.reload());
  listenToSheet(nodes, page);
  nodes.signOut.addEventListener("click", () => void page.signOut());
}

/** The operator's dashboard (`/painel`, E7.2, ADR 0085): sign in, then the counts; nothing before the login. */
function boot(): void {
  const root = document.getElementById(OPS_IDS.root);
  const firebase = root === null ? null : readFirebaseConfig(root.dataset);
  // Without the Firebase Web config the page stays as the server drew it.
  if (firebase === null) return;
  const nodes = findOpsElements(document);
  const environment: ViewEnvironment = { embedded: isEmbeddedBrowser(navigator.userAgent) };
  const auth = createFirebaseAuth(firebase);
  const page = createOpsPage({
    auth,
    api: createOpsFetchApi({
      fetch: (input, init) => fetch(input, init),
      idToken: () => auth.idToken(),
    }),
    onChange: (state) => {
      renderOpsPage(nodes, state, environment);
    },
  });
  listen(nodes, page);
  renderOpsPage(nodes, page.state(), environment);
  void page.start();
}

boot();
