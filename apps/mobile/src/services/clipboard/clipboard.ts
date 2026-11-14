/**
 * The clipboard of the phone (frontend.md, rule 3). Only "Copiar" of the invite puts text there: other
 * apps and the keyboard can read it, so nothing else ever does (ADR 0049, D7).
 */
export interface Clipboard {
  setText(text: string): Promise<void>;
}
