import type { ReactNativeOptions } from "@sentry/react-native";

import type { SentryConfig } from "../config/sentry";
import { scrubBreadcrumb, scrubEvent } from "../services/error-reporting/scrub-event";

/** Enough to tell what happened before an error, small enough to leave little to filter. */
const MAX_BREADCRUMBS = 30;

/**
 * No personal data added by the integrations (IP, cookies, the name of the phone), also on the native
 * side. Core marks the option as deprecated for `dataCollection`, which the React Native SDK does not
 * take (its options omit it), so this stays the only switch: kept explicit, apart from the literal.
 */
const NO_DEFAULT_PII = { sendDefaultPii: false } as const;

/**
 * The fixed options of the app's Sentry (E5.2, ADR 0080, D10). Errors only: no tracing (no
 * `tracesSampleRate`: even 0 turns the tracing integrations on), no replay, no screenshot and no view
 * hierarchy (both show the names of the players), no personal data, and every event and breadcrumb
 * through the scrubber.
 */
export function sentryOptions(config: SentryConfig): ReactNativeOptions {
  return {
    dsn: config.dsn,
    environment: config.environment,
    ...NO_DEFAULT_PII,
    attachScreenshot: false,
    attachViewHierarchy: false,
    reportAccessibilityIdentifier: false,
    attachStacktrace: true,
    enableAutoSessionTracking: true,
    enableAutoPerformanceTracing: false,
    enableCaptureFailedRequests: false,
    enableLogs: false,
    maxBreadcrumbs: MAX_BREADCRUMBS,
    beforeSend: (event) => scrubEvent(event),
    beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb),
  };
}
