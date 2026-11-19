import type { PageElements } from "./round-view";

/** The ids the Razor page renders (`Web/Pages/Round.cshtml`); a missing one means the page and the script disagree. */
export const ELEMENT_IDS = {
  root: "round-page",
  going: "answer-going",
  notGoing: "answer-not-going",
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

function required<T extends HTMLElement>(document: DocumentLike, key: ElementKey, type: new () => T): T {
  const element = document.getElementById(ELEMENT_IDS[key]);
  if (!(element instanceof type)) throw new Error(`The round page has no #${ELEMENT_IDS[key]}.`);
  return element;
}

function optional(document: DocumentLike, key: ElementKey): HTMLButtonElement | null {
  const element = document.getElementById(ELEMENT_IDS[key]);
  return element instanceof HTMLButtonElement ? element : null;
}

/** The page's nodes, the ones the view draws and the ones the script listens to. */
export interface PageNodes extends PageElements {
  readonly going: HTMLButtonElement | null;
  readonly notGoing: HTMLButtonElement | null;
  readonly signOut: HTMLButtonElement;
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

/** The answer buttons exist only while the round is open; everything else is always on the page. */
export function findPageElements(document: DocumentLike): PageNodes {
  return {
    going: optional(document, "going"),
    notGoing: optional(document, "notGoing"),
    status: required(document, "status", HTMLElement),
    signOut: required(document, "signOut", HTMLButtonElement),
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
