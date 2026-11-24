import type { SheetElements } from "./sign-in-sheet";

/** The ids the Razor pages render (`Web/Pages/Round.cshtml`, `Shared/_SignInSheet.cshtml`); a missing one means the page and the script disagree. */
export const ELEMENT_IDS = {
  root: "round-page",
  going: "answer-going",
  notGoing: "answer-not-going",
  leaveConfirm: "leave-confirm",
  leaveYes: "leave-yes",
  leaveKeep: "leave-keep",
  status: "page-status",
  signOut: "sign-out",
  sheet: "sheet",
  sheetTitle: "sheet-title",
  sheetClose: "sheet-close",
  choice: "sheet-choice",
  google: "sign-in-google",
  emailChoice: "sign-in-email",
  embeddedWarning: "embedded-warning",
  emailForm: "sheet-email",
  emailTabs: "email-tabs",
  signInTab: "email-sign-in",
  signUpTab: "email-sign-up",
  email: "email",
  passwordField: "password-field",
  password: "password",
  emailSubmit: "email-submit",
  forgot: "email-forgot",
  emailBack: "email-back",
  nicknameForm: "sheet-nickname",
  nickname: "nickname",
  nicknameSubmit: "nickname-submit",
  sheetMessage: "sheet-message",
} as const;

export type ElementKey = keyof typeof ELEMENT_IDS;

export interface DocumentLike {
  getElementById(id: string): HTMLElement | null;
}

/** The node of an id, of its type; a missing one means the page and the script disagree. */
export function requiredById<T extends HTMLElement>(
  document: DocumentLike,
  id: string,
  type: new () => T,
): T {
  const element = document.getElementById(id);
  if (!(element instanceof type)) throw new Error(`The page has no #${id}.`);
  return element;
}

function required<T extends HTMLElement>(
  document: DocumentLike,
  key: ElementKey,
  type: new () => T,
): T {
  return requiredById(document, ELEMENT_IDS[key], type);
}

function optional(document: DocumentLike, key: ElementKey): HTMLButtonElement | null {
  const element = document.getElementById(ELEMENT_IDS[key]);
  return element instanceof HTMLButtonElement ? element : null;
}

function optionalElement(document: DocumentLike, key: ElementKey): HTMLElement | null {
  return document.getElementById(ELEMENT_IDS[key]);
}

/** The nodes of the sheet of screen 02 (`Shared/_SignInSheet.cshtml`) the view draws and the script listens to. */
export interface SheetNodes extends SheetElements {
  readonly sheetClose: HTMLButtonElement;
  readonly google: HTMLButtonElement;
  readonly emailChoice: HTMLButtonElement;
  readonly signInTab: HTMLButtonElement;
  readonly signUpTab: HTMLButtonElement;
  readonly forgot: HTMLButtonElement;
  readonly emailBack: HTMLButtonElement;
  readonly emailForm: HTMLFormElement;
  readonly nicknameForm: HTMLFormElement;
  readonly email: HTMLInputElement;
  readonly password: HTMLInputElement;
  readonly nickname: HTMLInputElement;
}

/** The page's nodes, the ones the view draws and the ones the script listens to. */
export interface PageNodes extends SheetNodes {
  readonly going: HTMLButtonElement | null;
  readonly notGoing: HTMLButtonElement | null;
  readonly leaveConfirm: HTMLElement | null;
  readonly leaveYes: HTMLButtonElement | null;
  readonly leaveKeep: HTMLButtonElement | null;
  readonly status: HTMLElement;
  readonly signOut: HTMLButtonElement;
}

/** The sheet, on the round page and on the invite page alike. */
export function findSheetNodes(document: DocumentLike): SheetNodes {
  return {
    sheet: required(document, "sheet", HTMLElement),
    sheetTitle: required(document, "sheetTitle", HTMLElement),
    sheetClose: required(document, "sheetClose", HTMLButtonElement),
    choice: required(document, "choice", HTMLElement),
    google: required(document, "google", HTMLButtonElement),
    emailChoice: required(document, "emailChoice", HTMLButtonElement),
    embeddedWarning: required(document, "embeddedWarning", HTMLElement),
    emailForm: required(document, "emailForm", HTMLFormElement),
    emailTabs: required(document, "emailTabs", HTMLElement),
    signInTab: required(document, "signInTab", HTMLButtonElement),
    signUpTab: required(document, "signUpTab", HTMLButtonElement),
    email: required(document, "email", HTMLInputElement),
    passwordField: required(document, "passwordField", HTMLElement),
    password: required(document, "password", HTMLInputElement),
    emailSubmit: required(document, "emailSubmit", HTMLButtonElement),
    forgot: required(document, "forgot", HTMLButtonElement),
    emailBack: required(document, "emailBack", HTMLButtonElement),
    nicknameForm: required(document, "nicknameForm", HTMLFormElement),
    nickname: required(document, "nickname", HTMLInputElement),
    nicknameSubmit: required(document, "nicknameSubmit", HTMLButtonElement),
    sheetMessage: required(document, "sheetMessage", HTMLElement),
  };
}

/** The answer buttons exist only while the round is open; everything else is always on the page. */
export function findPageElements(document: DocumentLike): PageNodes {
  return {
    ...findSheetNodes(document),
    going: optional(document, "going"),
    notGoing: optional(document, "notGoing"),
    leaveConfirm: optionalElement(document, "leaveConfirm"),
    leaveYes: optional(document, "leaveYes"),
    leaveKeep: optional(document, "leaveKeep"),
    status: required(document, "status", HTMLElement),
    signOut: required(document, "signOut", HTMLButtonElement),
  };
}
