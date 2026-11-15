import type { ExternalLink } from "../services/links/external-link";

export interface FakeExternalLink extends ExternalLink {
  /** Every address asked, in order. */
  readonly opened: () => readonly string[];
}

/** `installed` says whether an app answers the address (WhatsApp on the phone or not). */
export function createFakeExternalLink(installed: boolean): FakeExternalLink {
  const log = { value: [] as readonly string[] };
  return {
    open: (url) => {
      log.value = [...log.value, url];
      return Promise.resolve(installed);
    },
    opened: () => log.value,
  };
}
