/** An `https:` address with a host and no spaces; anything else is not offered (question 62). */
const HTTPS_URL = /^https:\/\/[^\s/?#]+(?:[/?#]\S*)?$/i;
/** The `https:` origin at the start of an address (scheme, host, optional port); its path, query and fragment are dropped. */
const HTTPS_ORIGIN = /^https:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::[0-9]{1,5})?(?=$|[/?#])(?!\S*\s)/i;

/** The API's own pages (E6.1, ADR 0083), on the origin of the invite page. */
export const TERMS_PATH = "/termos";
export const PRIVACY_PATH = "/privacidade";

export interface LegalLinks {
  /** `null` without an address: the text shows without the link (ADR 0057). */
  readonly terms: string | null;
  readonly privacy: string | null;
}

/** What the build says: the explicit addresses (optional override) and the origin of the invite page. */
export interface LegalLinkInputs {
  readonly termsUrl: unknown;
  readonly privacyUrl: unknown;
  readonly inviteBaseUrl: unknown;
}

export function parseLegalUrl(raw: unknown): string | null {
  return typeof raw === "string" && HTTPS_URL.test(raw) ? raw : null;
}

/** The `https:` origin of an address, in lower case, or `null`. */
export function httpsOrigin(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const match = HTTPS_ORIGIN.exec(raw);
  return match ? match[0].toLowerCase() : null;
}

/**
 * The explicit address wins; without it, the page of the API on the invite page's origin (same host as `/r`
 * and `/c`, ADR 0070, D8), so a build with `EXPO_PUBLIC_INVITE_BASE_URL` needs no new variable.
 */
export function resolveLegalLinks(inputs: LegalLinkInputs): LegalLinks {
  const origin = httpsOrigin(inputs.inviteBaseUrl);
  const derived = (path: string): string | null => (origin === null ? null : `${origin}${path}`);
  return {
    terms: parseLegalUrl(inputs.termsUrl) ?? derived(TERMS_PATH),
    privacy: parseLegalUrl(inputs.privacyUrl) ?? derived(PRIVACY_PATH),
  };
}

// Expo replaces these exact expressions when it bundles, so they cannot be read through a variable.
const RAW_TERMS_URL: unknown = process.env.EXPO_PUBLIC_TERMS_URL;
const RAW_PRIVACY_URL: unknown = process.env.EXPO_PUBLIC_PRIVACY_URL;
const RAW_INVITE_URL: unknown = process.env.EXPO_PUBLIC_INVITE_BASE_URL;

export function buildLegalLinks(): LegalLinks {
  return resolveLegalLinks({
    termsUrl: RAW_TERMS_URL,
    privacyUrl: RAW_PRIVACY_URL,
    inviteBaseUrl: RAW_INVITE_URL,
  });
}
