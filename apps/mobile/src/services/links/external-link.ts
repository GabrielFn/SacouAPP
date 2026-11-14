/** Opens an address in another app (WhatsApp, the browser). The address is never logged. */
export interface ExternalLink {
  /** `false` when no app on the phone opens it; the caller then offers another way. */
  open(url: string): Promise<boolean>;
}
