import { findSheetNodes, requiredById, type DocumentLike, type SheetNodes } from "./page-elements";

/** The ids `Web/Pages/Invite.cshtml` renders; the sheet's come from `Shared/_SignInSheet.cshtml`. */
export const INVITE_IDS = {
  root: "invite-page",
  title: "invite-title",
  detail: "invite-detail",
  status: "page-status",
  signIn: "invite-sign-in",
  join: "invite-join",
  signOut: "sign-out",
} as const;

/** The invite page's nodes, the ones the view draws and the ones the script listens to. */
export interface InviteNodes extends SheetNodes {
  readonly title: HTMLElement;
  readonly detail: HTMLElement;
  readonly status: HTMLElement;
  readonly signIn: HTMLButtonElement;
  readonly join: HTMLButtonElement;
  readonly signOut: HTMLButtonElement;
}

export function findInviteElements(document: DocumentLike): InviteNodes {
  return {
    ...findSheetNodes(document),
    title: requiredById(document, INVITE_IDS.title, HTMLElement),
    detail: requiredById(document, INVITE_IDS.detail, HTMLElement),
    status: requiredById(document, INVITE_IDS.status, HTMLElement),
    signIn: requiredById(document, INVITE_IDS.signIn, HTMLButtonElement),
    join: requiredById(document, INVITE_IDS.join, HTMLButtonElement),
    signOut: requiredById(document, INVITE_IDS.signOut, HTMLButtonElement),
  };
}
