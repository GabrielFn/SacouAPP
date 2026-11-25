/**
 * Where the errors of this build go (E5.2, ADR 0080). The DSN of a mobile app is public by design (it
 * ships in the APK), so it is a public build variable, never a secret; without it nothing is sent.
 */
export interface SentryConfig {
  readonly dsn: string;
  readonly environment: string;
}

/** `https://<key>@<host>/<project id>`: the shape of a Sentry DSN, nothing else is accepted. */
const DSN_PATTERN = /^https:\/\/[A-Za-z0-9]+@[A-Za-z0-9.-]+(:[0-9]+)?\/[0-9]+$/;
const ENVIRONMENT_PATTERN = /^[a-z][a-z0-9-]*$/;
export const DEFAULT_SENTRY_ENVIRONMENT = "development";

/** The config, or `null` (Sentry off) when the DSN is missing, empty or not a Sentry DSN. */
export function readSentryConfig(rawDsn: unknown, rawEnvironment: unknown): SentryConfig | null {
  if (typeof rawDsn !== "string" || !DSN_PATTERN.test(rawDsn)) return null;
  const environment =
    typeof rawEnvironment === "string" && ENVIRONMENT_PATTERN.test(rawEnvironment)
      ? rawEnvironment
      : DEFAULT_SENTRY_ENVIRONMENT;
  return { dsn: rawDsn, environment };
}

// Expo replaces these exact expressions when it bundles, so they cannot be read through a variable.
const RAW_DSN: unknown = process.env.EXPO_PUBLIC_SENTRY_DSN;
const RAW_ENVIRONMENT: unknown = process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT;

export function buildSentryConfig(): SentryConfig | null {
  return readSentryConfig(RAW_DSN, RAW_ENVIRONMENT);
}
