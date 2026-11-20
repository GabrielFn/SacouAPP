import type { Failure, Notice, SheetForm, SignInAttempt } from "../round-page/round-page.types";

/** What `POST /v1/invites/preview` tells: the group's name, its active members, and whether the caller is one already. */
export interface InvitePreview {
  readonly groupName: string;
  readonly activeMembers: number;
  readonly alreadyMember: boolean;
}

/**
 * The invite page's flow (ADR 0070, D8): `idle → signIn → signingIn → previewing → preview → joining → joined`, or
 * `failed` when the link leads nowhere. The token itself is never in the state: the controller keeps it in memory.
 */
export type InvitePageState =
  | { readonly step: "starting" }
  | { readonly step: "idle"; readonly signedIn: boolean; readonly failure: Failure | null }
  | {
      readonly step: "signIn";
      readonly form: SheetForm;
      readonly failure: Failure | null;
      readonly notice: Notice | null;
    }
  | { readonly step: "signingIn"; readonly attempt: SignInAttempt }
  /** `POST /v1/me`, then the preview. */
  | { readonly step: "previewing" }
  | { readonly step: "preview"; readonly preview: InvitePreview; readonly failure: Failure | null }
  | { readonly step: "joining"; readonly preview: InvitePreview }
  | { readonly step: "joined"; readonly groupName: string; readonly alreadyMember: boolean }
  /** The end of the road: a dead or malformed link, or a person the group removed. */
  | { readonly step: "failed"; readonly failure: Failure };

export type InviteStep = InvitePageState["step"];
