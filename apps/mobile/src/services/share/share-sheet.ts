/**
 * Opens the system share sheet with a text (WhatsApp is one of the targets). The screens depend on this
 * contract, never on the SDK (frontend.md, rule 3). The text may name people: it is never logged.
 */
export interface ShareSheet {
  /** Resolves when the sheet closes, shared or not; a failure to open it is ignored. */
  share(text: string): Promise<void>;
}
