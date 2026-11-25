import { beforeEach, describe, expect, test, vi } from "vitest";

import { REDACTED, scrubEvent } from "../services/error-reporting/scrub-event";
import { noopErrorReporter } from "./noop-error-reporter";
import { startErrorReporter } from "./sentry-error-reporter";

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  nativeCrash: vi.fn(),
  wrap: vi.fn(),
}));
vi.mock("@sentry/react-native", () => sentry);

const CONFIG = { dsn: "https://key@o1.ingest.us.sentry.io/2", environment: "preview" };

describe("the Sentry adapter behind the ErrorReporter port (E5.2 part 2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("without a DSN Sentry never starts and the port is the no-op", () => {
    const reporter = startErrorReporter(null);
    reporter.captureError(new Error("a@b.com"), { area: "x" });
    expect(reporter).toBe(noopErrorReporter);
    expect(sentry.init).not.toHaveBeenCalled();
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  test("with a DSN it starts once, with PII off, and tags only the area", () => {
    const reporter = startErrorReporter(CONFIG);
    reporter.captureError(new Error("boom"), { area: "court" });
    expect(sentry.init).toHaveBeenCalledTimes(1);
    expect(sentry.init.mock.calls[0]?.[0]).toMatchObject({
      dsn: CONFIG.dsn,
      sendDefaultPii: false,
    });
    expect(sentry.captureException).toHaveBeenCalledWith(expect.any(Error), {
      tags: { area: "court" },
    });
  });
});

describe("the scrubber on the leaks that come in links and exceptions", () => {
  test("a deep link with the invite token in the fragment inside an exception keeps only the route", () => {
    const event = scrubEvent({
      exception: { values: [{ value: "bad sacou://c/ABC123#tok.en and https://x.app/r/XYZ?a=b" }] },
    });
    const text = event.exception.values[0].value;
    expect(text).toBe("bad sacou://c/{code} and https://x.app/r/{code}");
  });

  test("an e-mail in the transaction and in the logentry params never leaves", () => {
    const event = scrubEvent({
      transaction: "GET /u/a@b.com",
      logentry: { message: "hi a@b.com", params: ["a@b.com", { email: "a@b.com" }] },
    });
    expect(JSON.stringify(event)).not.toContain("a@b.com");
    expect(event.transaction).toBe(`GET /u/${REDACTED}`);
  });

  test("an empty event does not break the scrubber", () => {
    expect(() => scrubEvent({})).not.toThrow();
  });
});
