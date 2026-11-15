/**
 * The clipboard of the phone (frontend.md, rule 3). Only "Copiar" of the invite and "Copiar lista" of the
 * round put text there, each on its tap: other apps and the
 * keyboard can read it, so nothing else ever does (ADR 0049, D7; ADR 0054).
 */
export interface Clipboard {
  setText(text: string): Promise<void>;
}
