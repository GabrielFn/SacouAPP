import * as Sentry from "@sentry/react-native";
import type { ComponentType } from "react";

import type { SentryConfig } from "../config/sentry";
import type { ErrorReporter } from "../services/error-reporting/error-reporter";
import { ANONYMOUS_USER } from "../services/error-reporting/scrub-event";
import { noopErrorReporter } from "./noop-error-reporter";
import { sentryOptions } from "./sentry-options";

const AREA_TAG = "area";

/**
 * Starts Sentry once, before the first screen mounts, and returns the port the app uses (E5.2,
 * ADR 0080, D9). Without a config (no DSN) Sentry never starts and nothing leaves the phone. The
 * scope gets the anonymous user right away (D14): the SDK copies it to the native side, so a native
 * crash, which skips `beforeSend`, carries it instead of the installation id and the IP geo.
 */
export function startErrorReporter(config: SentryConfig | null): ErrorReporter {
  if (config === null) return noopErrorReporter;
  Sentry.init(sentryOptions(config));
  Sentry.setUser(ANONYMOUS_USER);
  return {
    captureError: (error, context) => {
      Sentry.captureException(
        error,
        context === undefined ? undefined : { tags: { [AREA_TAG]: context.area } },
      );
    },
    crashNatively: () => {
      Sentry.nativeCrash();
    },
  };
}

/**
 * The root with Sentry's touch boundary when Sentry is on. Touches keep the component names only:
 * the text inside a button may be a nickname (and the scrubber drops the labels too).
 */
export function withErrorReporting<P extends Record<string, unknown>>(
  root: ComponentType<P>,
  config: SentryConfig | null,
): ComponentType<P> {
  if (config === null) return root;
  return Sentry.wrap(root, { touchEventBoundaryProps: { extractTextFromChildren: false } });
}
