import { describe, expect, it } from "vitest";

import type { RoundPageState } from "../round-page/round-page.types";

import {
  renderRoundPage,
  type Control,
  type Field,
  type PageElements,
  type Shown,
  type TextSlot,
} from "./round-view";

const slot = (): TextSlot => ({ hidden: false, textContent: "" });
const shown = (): Shown => ({ hidden: false });
const control = (): Control => ({ hidden: false, textContent: "", disabled: false });
const field = (): Field => ({ value: "", disabled: false });

function elements(): PageElements {
  return {
    going: control(),
    notGoing: control(),
    status: slot(),
    signOut: control(),
    sheet: shown(),
    sheetTitle: slot(),
    choice: shown(),
    google: control(),
    embeddedWarning: shown(),
    emailForm: shown(),
    emailTabs: shown(),
    email: field(),
    passwordField: shown(),
    password: field(),
    emailSubmit: control(),
    forgot: control(),
    nicknameForm: shown(),
    nickname: field(),
    nicknameSubmit: control(),
    sheetMessage: slot(),
  };
}

const browser = { embedded: false };

function idle(over: Partial<Extract<RoundPageState, { step: "idle" }>> = {}): RoundPageState {
  return {
    step: "idle",
    signedIn: true,
    nicknameSuggestion: null,
    standing: null,
    failure: null,
    ...over,
  };
}

describe("renderRoundPage", () => {
  it("signed out: VOU and NÃO VOU on, the sheet closed, nothing to say", () => {
    const page = elements();
    renderRoundPage(page, idle({ signedIn: false }), browser);
    expect([page.going?.hidden, page.going?.disabled, page.notGoing?.textContent]).toEqual([
      false,
      false,
      "NÃO VOU",
    ]);
    expect([page.sheet.hidden, page.status.hidden, page.signOut.hidden]).toEqual([
      true,
      true,
      true,
    ]);
  });

  it("going: the status by textContent, NÃO VOU MAIS and Sair", () => {
    const page = elements();
    renderRoundPage(page, idle({ standing: { status: "going", position: 10 } }), browser);
    expect(page.status.textContent).toBe("Você vai. Sua vaga é a 10ª.");
    expect([page.going?.hidden, page.notGoing?.textContent, page.signOut.hidden]).toEqual([
      true,
      "NÃO VOU MAIS",
      false,
    ]);
  });

  it("waitlisted and not going", () => {
    const page = elements();
    renderRoundPage(page, idle({ standing: { status: "waitlisted", position: 2 } }), browser);
    expect(page.status.textContent).toBe("Na espera, 2º.");
    renderRoundPage(page, idle({ standing: { status: "notGoing", position: null } }), browser);
    expect([page.status.textContent, page.going?.hidden, page.notGoing?.hidden]).toEqual([
      "Você marcou que não vai.",
      false,
      true,
    ]);
  });

  it("a refusal after joining says the person is in the group", () => {
    const page = elements();
    renderRoundPage(page, idle({ failure: { kind: "dropInWindowClosed", joined: true } }), browser);
    expect(page.status.textContent).toBe(
      "Você entrou no grupo. A lista dos avulsos ainda não abriu.",
    );
  });

  it("a 429 says the wait", () => {
    const page = elements();
    renderRoundPage(
      page,
      idle({ failure: { kind: "rateLimited", retryAfterSeconds: 9 } }),
      browser,
    );
    expect(page.status.textContent).toBe("Muitas tentativas. Tente de novo em 9 s.");
  });

  it("the sheet in an in-app browser hides Google and says to open the browser (case 32)", () => {
    const page = elements();
    renderRoundPage(
      page,
      { step: "signIn", intent: "going", form: "choice", failure: null, notice: null },
      { embedded: true },
    );
    expect([
      page.sheet.hidden,
      page.choice.hidden,
      page.google.hidden,
      page.embeddedWarning.hidden,
    ]).toEqual([false, false, true, false]);
  });

  it("the reset form hides the password and the tabs, and names its button", () => {
    const page = elements();
    renderRoundPage(
      page,
      { step: "signIn", intent: "going", form: "reset", failure: null, notice: null },
      browser,
    );
    expect([
      page.emailForm.hidden,
      page.passwordField.hidden,
      page.emailTabs.hidden,
      page.emailSubmit.textContent,
      page.sheetTitle.textContent,
    ]).toEqual([false, true, true, "Mandar link", "Recuperar a senha"]);
  });

  it("a running request disables the controls and says so", () => {
    const page = elements();
    renderRoundPage(page, { step: "signingIn", intent: "going", attempt: "signIn" }, browser);
    expect([page.emailSubmit.disabled, page.email.disabled, page.sheetMessage.textContent]).toEqual(
      [true, true, "Um instante…"],
    );
    renderRoundPage(page, { step: "answering", intent: "going", standing: null }, browser);
    expect([page.going?.disabled, page.status.textContent, page.sheet.hidden]).toEqual([
      true,
      "Um instante…",
      true,
    ]);
  });

  it("the nickname step shows its form and the refusal", () => {
    const page = elements();
    const state: RoundPageState = {
      step: "nickname",
      intent: "going",
      suggestion: "<b>Ana</b>",
      failure: { kind: "nicknameInvalid" },
    };
    renderRoundPage(page, state, browser);
    expect([
      page.nicknameForm.hidden,
      page.emailForm.hidden,
      page.sheetMessage.textContent,
    ]).toEqual([false, true, "Use letras, números ou emojis, até 20, sem símbolos invisíveis."]);
  });

  it("a closed round has no answer buttons and the view still draws", () => {
    const page = { ...elements(), going: null, notGoing: null };
    renderRoundPage(page, idle({ failure: { kind: "roundClosed" } }), browser);
    expect(page.status.textContent).toBe("Essa rodada já fechou.");
  });
});
