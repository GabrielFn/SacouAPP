import type { SheetForm } from "../round-page/round-page.types";
import { webStrings } from "../strings.pt-BR";

/** What the view writes on a node: text through `textContent` only, never HTML (lint forbids `innerHTML` and the like). */
export interface Shown {
  /** `boolean | "until-found"` in the DOM; the view writes booleans only. */
  hidden: boolean | string;
}

export interface TextSlot extends Shown {
  textContent: string | null;
}

export interface Control extends TextSlot {
  disabled: boolean;
}

export interface Field {
  value: string;
  disabled: boolean;
}

/** The nodes of the sheet of screen 02 (`Web/Pages/Shared/_SignInSheet.cshtml`), the same on the round and invite pages. */
export interface SheetElements {
  readonly sheet: Shown;
  readonly sheetTitle: TextSlot;
  readonly choice: Shown;
  readonly google: Control;
  readonly embeddedWarning: Shown;
  readonly emailForm: Shown;
  readonly emailTabs: Shown;
  readonly email: Field;
  readonly passwordField: Shown;
  readonly password: Field;
  readonly emailSubmit: Control;
  readonly forgot: Control;
  readonly nicknameForm: Shown;
  readonly nickname: Field;
  readonly nicknameSubmit: Control;
  readonly sheetMessage: TextSlot;
}

export interface ViewEnvironment {
  /** An in-app browser where Google refuses the sign-in: the Google button gives way to "Abra no navegador". */
  readonly embedded: boolean;
}

/** What each page wants of the sheet: which form shows (null when closed), its title, whether it waits, and its line. */
export interface SheetView {
  readonly form: SheetForm | "nickname" | null;
  readonly title: string;
  readonly busy: boolean;
  readonly message: string | null;
}

export function write(slot: TextSlot, text: string | null): void {
  slot.hidden = text === null;
  slot.textContent = text ?? "";
}

/** The sheet from its view: the same view always draws the same sheet. */
export function renderSignInSheet(
  elements: SheetElements,
  view: SheetView,
  environment: ViewEnvironment,
): void {
  const { form, busy } = view;
  elements.sheet.hidden = form === null;
  elements.sheetTitle.textContent = view.title;
  elements.choice.hidden = form !== "choice";
  elements.google.hidden = environment.embedded;
  elements.google.disabled = busy;
  elements.embeddedWarning.hidden = !environment.embedded;
  elements.emailForm.hidden = form !== "signIn" && form !== "signUp" && form !== "reset";
  elements.emailTabs.hidden = form === "reset";
  elements.passwordField.hidden = form === "reset";
  elements.email.disabled = busy;
  elements.password.disabled = busy;
  elements.emailSubmit.disabled = busy;
  elements.emailSubmit.textContent =
    webStrings.submit[form === "signUp" || form === "reset" ? form : "signIn"];
  elements.forgot.hidden = form !== "signIn";
  elements.nicknameForm.hidden = form !== "nickname";
  elements.nickname.disabled = busy;
  elements.nicknameSubmit.disabled = busy;
  write(elements.sheetMessage, view.message);
}
