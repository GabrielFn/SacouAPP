/** An `https:` address with a host and no spaces; anything else is not offered (question 62). */
const HTTPS_URL = /^https:\/\/[^\s/?#]+(?:[/?#]\S*)?$/i;

export interface LegalLinks {
  /** `null` until E6.1 publishes the document: the text shows without the link. */
  readonly terms: string | null;
  readonly privacy: string | null;
}

export function parseLegalUrl(raw: unknown): string | null {
  return typeof raw === "string" && HTTPS_URL.test(raw) ? raw : null;
}

// Expo replaces these exact expressions when it bundles, so they cannot be read through a variable.
const RAW_TERMS_URL: unknown = process.env.EXPO_PUBLIC_TERMS_URL;
const RAW_PRIVACY_URL: unknown = process.env.EXPO_PUBLIC_PRIVACY_URL;

export function buildLegalLinks(): LegalLinks {
  return { terms: parseLegalUrl(RAW_TERMS_URL), privacy: parseLegalUrl(RAW_PRIVACY_URL) };
}
