import type { LegalLinks } from "../../../config/legal-links";
import type { MyProfile } from "../../../services/api/sacou-api";
import type { AccountView } from "../../../services/auth/auth-session";
import { strings } from "../../../strings/pt-BR";

export interface AccountViewInput {
  /** From the phone (the SDK), never from the API, which keeps no e-mail (ADR 0036, D3). */
  readonly account: AccountView;
  /** `undefined` while it loads; `null` when it was never saved. */
  readonly profile: MyProfile | null | undefined;
  readonly legalLinks: LegalLinks;
}

/** What screen 30 shows, derived on every render (frontend.md, rule 1). */
export interface AccountScreenView {
  /** The nickname, "Definir apelido" without a profile, or empty while it loads. */
  readonly nickname: string;
  readonly nicknameA11y: string;
  /** `null` hides the row (an Apple login with the e-mail hidden has the relay address instead). */
  readonly email: string | null;
  readonly provider: string;
  readonly showsGoogleMark: boolean;
  readonly termsUrl: string | null;
  readonly privacyUrl: string | null;
}

const { account: texts } = strings;

function nicknameOf(profile: MyProfile | null | undefined): string {
  if (profile === undefined) return "";
  return profile === null ? texts.setNickname : profile.nickname;
}

export function accountScreenView({
  account,
  profile,
  legalLinks,
}: AccountViewInput): AccountScreenView {
  const nickname = nicknameOf(profile);
  return {
    nickname,
    nicknameA11y:
      profile === null || profile === undefined ? texts.setNickname : texts.nicknameLabel(nickname),
    email: account.email,
    provider: texts.providers[account.provider],
    showsGoogleMark: account.provider === "google",
    termsUrl: legalLinks.terms,
    privacyUrl: legalLinks.privacy,
  };
}
