import type { SheetForm } from "../round-page/round-page.types";

import type { SheetNodes } from "./page-elements";

/** What the sheet of screen 02 calls, on the round page and on the invite page alike. */
export interface SheetControls {
  closeSheet(): void;
  chooseForm(form: SheetForm): void;
  signInWithGoogle(): Promise<void>;
  submitEmail(email: string, password: string): Promise<void>;
}

/** The sheet's buttons and its e-mail form; the nickname form is the round page's own. */
export function listenToSheet(nodes: SheetNodes, sheet: SheetControls): void {
  nodes.sheetClose.addEventListener("click", () => {
    sheet.closeSheet();
  });
  nodes.google.addEventListener("click", () => void sheet.signInWithGoogle());
  const forms: readonly (readonly [HTMLButtonElement, SheetForm])[] = [
    [nodes.emailChoice, "signIn"],
    [nodes.signInTab, "signIn"],
    [nodes.signUpTab, "signUp"],
    [nodes.forgot, "reset"],
    [nodes.emailBack, "choice"],
  ];
  for (const [button, form] of forms) {
    button.addEventListener("click", () => {
      sheet.chooseForm(form);
    });
  }
  nodes.emailForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void sheet.submitEmail(nodes.email.value.trim(), nodes.password.value);
  });
}
