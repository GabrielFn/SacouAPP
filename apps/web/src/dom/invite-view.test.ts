import { describe, expect, it } from "vitest";

import type { InvitePageState } from "../invite-page/invite-page.types";

import { renderInvitePage, type InviteElements } from "./invite-view";
import type { Control, Field, Shown, TextSlot } from "./sign-in-sheet";

const slot = (): TextSlot => ({ hidden: false, textContent: "" });
const shown = (): Shown => ({ hidden: false });
const control = (): Control => ({ hidden: false, textContent: "", disabled: false });
const field = (): Field => ({ value: "", disabled: false });

function elements(): InviteElements {
  return {
    title: slot(),
    detail: slot(),
    status: slot(),
    signIn: control(),
    join: control(),
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
const PREVIEW = { groupName: "<b>Racha</b>", activeMembers: 14, alreadyMember: false };

function draw(state: InvitePageState): InviteElements {
  const page = elements();
  renderInvitePage(page, state, browser);
  return page;
}

describe("renderInvitePage", () => {
  it("signed out: the sign-in button, the sheet closed", () => {
    const page = draw({ step: "idle", signedIn: false, failure: null });
    expect(page.signIn).toMatchObject({ hidden: false, disabled: false });
    expect(page.signIn.textContent).toBe("ENTRAR PRA VER O CONVITE");
    expect(page.join.hidden).toBe(true);
    expect(page.sheet.hidden).toBe(true);
    expect(page.signOut.hidden).toBe(true);
  });

  it("the sheet carries the invite's own title", () => {
    const page = draw({ step: "signIn", form: "choice", failure: null, notice: null });
    expect(page.sheet.hidden).toBe(false);
    expect(page.sheetTitle.textContent).toBe("Entrar pra ver o convite");
    expect(page.nicknameForm.hidden).toBe(true);
  });

  it("the preview: the group's name as text, its members, and ENTRAR NO GRUPO", () => {
    const page = draw({ step: "preview", preview: PREVIEW, failure: null });
    expect(page.title.textContent).toBe("<b>Racha</b>");
    expect(page.detail.textContent).toBe("14 membros");
    expect(page.join).toMatchObject({ hidden: false, disabled: false });
    expect(page.signIn.hidden).toBe(true);
    expect(page.signOut.hidden).toBe(false);
  });

  it("joined, and already a member, each with its line", () => {
    expect(
      draw({ step: "joined", groupName: "Racha", alreadyMember: false }).detail.textContent,
    ).toBe("Você entrou. Baixe o app para ver as rodadas.");
    const already = draw({ step: "joined", groupName: "Racha", alreadyMember: true });
    expect(already.detail.textContent).toBe(
      "Você já está nesse grupo. Abra o app para ver as rodadas.",
    );
    expect(already.join.hidden).toBe(true);
  });

  it("a dead link says so, with no button", () => {
    const page = draw({ step: "failed", failure: { kind: "inviteInvalid" } });
    expect(page.status).toMatchObject({
      hidden: false,
      textContent: "Link inválido ou desativado.",
    });
    expect(page.signIn.hidden).toBe(true);
    expect(page.join.hidden).toBe(true);
    expect(page.detail.hidden).toBe(true);
  });

  it("signed in after a failure: the button tries the preview again", () => {
    const page = draw({ step: "idle", signedIn: true, failure: { kind: "offline" } });
    expect(page.signIn.textContent).toBe("VER O CONVITE");
    expect(page.status.textContent).toBe("Sem conexão com o Sacou agora. Tente de novo.");
  });
});
