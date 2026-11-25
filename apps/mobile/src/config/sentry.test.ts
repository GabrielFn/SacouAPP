import { describe, expect, test } from "vitest";

import { DEFAULT_SENTRY_ENVIRONMENT, readSentryConfig } from "./sentry";

const DSN = "https://abc123def456@o4500000000000000.ingest.us.sentry.io/4500000000000001";

describe("the Sentry config of the build (E5.2, ADR 0080, D1)", () => {
  test.each([
    ["missing", undefined],
    ["empty", ""],
    ["not a string", 42],
    ["over http", DSN.replace("https://", "http://")],
    ["without the key", "https://o1.ingest.sentry.io/2"],
    ["with a path after the project", `${DSN}/extra`],
    ["with spaces", ` ${DSN}`],
  ])("a DSN %s turns Sentry off", (_, raw) => {
    expect(readSentryConfig(raw, "staging")).toBeNull();
  });

  test("a valid DSN turns Sentry on with the environment of the build profile", () => {
    expect(readSentryConfig(DSN, "staging")).toEqual({ dsn: DSN, environment: "staging" });
  });

  test.each([undefined, "", "Staging Env", 1])(
    "an environment that is missing or odd (%s) falls back to development",
    (raw) => {
      expect(readSentryConfig(DSN, raw)?.environment).toBe(DEFAULT_SENTRY_ENVIRONMENT);
    },
  );
});
