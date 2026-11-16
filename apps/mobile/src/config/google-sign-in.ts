/** The shape of a Google OAuth client ID: digits, a dash, the key and the Google domain. */
const GOOGLE_CLIENT_ID = /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/;

/**
 * The web client ID of the Firebase project, or `null`: then the Google button hides and the e-mail
 * login stays (ADR 0057, D2). It is public (it goes inside the APK), not a secret.
 */
export function parseGoogleWebClientId(raw: unknown): string | null {
  return typeof raw === "string" && GOOGLE_CLIENT_ID.test(raw) ? raw : null;
}

// Expo replaces this exact expression when it bundles, so it cannot be read through a variable.
const RAW_GOOGLE_WEB_CLIENT_ID: unknown = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

export function buildGoogleWebClientId(): string | null {
  return parseGoogleWebClientId(RAW_GOOGLE_WEB_CLIENT_ID);
}
