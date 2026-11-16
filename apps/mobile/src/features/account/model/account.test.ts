import { describe, expect, test } from "vitest";

import type { MyProfile } from "../../../services/api/sacou-api";
import type { AccountView } from "../../../services/auth/auth-session";
import { strings } from "../../../strings/pt-BR";
import { isAccountScreenReady, PENDING_ACCOUNT_SCREENS } from "../navigation";
import { accountScreenView } from "./account-view";

const GOOGLE: AccountView = { provider: "google", email: "joao@gmail.com", displayName: "João" };
const PROFILE: MyProfile = {
  nickname: "João",
  primaryPosition: null,
  otherPositions: [],
  suggestedLevel: null,
};
const LINKS = { terms: "https://sacou.app/termos", privacy: "https://sacou.app/privacidade" };
const NO_LINKS = { terms: null, privacy: null };
const { account: texts } = strings;

describe("screen 30 (question 60)", () => {
  test("a Google login with e-mail: the nickname, the e-mail and 'Login · Google'", () => {
    const view = accountScreenView({ account: GOOGLE, profile: PROFILE, legalLinks: LINKS });
    expect(view).toMatchObject({
      nickname: "João",
      nicknameA11y: "Apelido: João. Alterar",
      email: "joao@gmail.com",
      provider: "Google",
      showsGoogleMark: true,
      termsUrl: LINKS.terms,
      privacyUrl: LINKS.privacy,
    });
  });

  test("a login by e-mail says 'E-mail', without the G", () => {
    const view = accountScreenView({
      account: { ...GOOGLE, provider: "password" },
      profile: PROFILE,
      legalLinks: LINKS,
    });
    expect(view.provider).toBe("E-mail");
    expect(view.showsGoogleMark).toBe(false);
  });

  test("without an e-mail the row is gone; without a profile, 'Definir apelido'", () => {
    const view = accountScreenView({
      account: { ...GOOGLE, email: null },
      profile: null,
      legalLinks: NO_LINKS,
    });
    expect(view.email).toBeNull();
    expect(view.nickname).toBe(texts.setNickname);
    expect(view.nicknameA11y).toBe(texts.setNickname);
    expect(view.termsUrl).toBeNull();
    expect(view.privacyUrl).toBeNull();
  });

  test("while the profile loads the value is empty, never a guess", () => {
    expect(
      accountScreenView({ account: GOOGLE, profile: undefined, legalLinks: LINKS }).nickname,
    ).toBe("");
  });

  test("exporting and deleting are ready since part 3; a pending screen still hides", () => {
    expect(isAccountScreenReady("export")).toBe(true);
    expect(isAccountScreenReady("delete")).toBe(true);
    expect([...PENDING_ACCOUNT_SCREENS]).toEqual([]);
    expect(isAccountScreenReady("export", new Set(["export"]))).toBe(false);
  });

  test("the e-mail and the provider come from the phone: the view has no UID", () => {
    const view = accountScreenView({ account: GOOGLE, profile: PROFILE, legalLinks: LINKS });
    expect(Object.keys(view)).not.toContain("uid");
  });
});
