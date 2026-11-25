import { describe, expect, test } from "vitest";

import { REDACTED } from "../services/error-reporting/scrub-event";
import { sentryOptions } from "./sentry-options";

const CONFIG = { dsn: "https://key@o1.ingest.us.sentry.io/2", environment: "staging" };

describe("the options of the app's Sentry (E5.2, ADR 0080, D10 and R4)", () => {
  const options = sentryOptions(CONFIG);

  test("sends to the DSN and environment of the build", () => {
    expect(options.dsn).toBe(CONFIG.dsn);
    expect(options.environment).toBe("staging");
  });

  test("no personal data, no screenshot and no view hierarchy", () => {
    expect(options).toHaveProperty("sendDefaultPii", false);
    expect(options.attachScreenshot).toBe(false);
    expect(options.attachViewHierarchy).toBe(false);
  });

  test("errors only: no tracing, no replay, no logs, no failed-request events", () => {
    expect(options.tracesSampleRate).toBeUndefined();
    expect(options.tracesSampler).toBeUndefined();
    expect(options.replaysSessionSampleRate).toBeUndefined();
    expect(options.replaysOnErrorSampleRate).toBeUndefined();
    expect(options.profilesSampleRate).toBeUndefined();
    expect(options.enableAutoPerformanceTracing).toBe(false);
    expect(options.enableLogs).toBe(false);
    expect(options.enableCaptureFailedRequests).toBe(false);
  });

  test("every breadcrumb goes through the scrubber, console lines are dropped", () => {
    expect(options.beforeBreadcrumb?.({ category: "console", message: "x" })).toBeNull();
    expect(options.beforeBreadcrumb?.({ category: "app", message: "a@b.com" })?.message).toBe(
      REDACTED,
    );
  });

  test("every event goes through the scrubber", async () => {
    const event = await options.beforeSend?.(
      { type: undefined, message: "for a@b.com", user: { email: "a@b.com" } },
      {},
    );
    expect(event?.message).toBe(`for ${REDACTED}`);
    expect(event?.user).toBeUndefined();
  });
});
