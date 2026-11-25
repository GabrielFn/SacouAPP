import { describe, expect, test } from "vitest";

import type { ErrorReporter } from "../services/error-reporting/error-reporter";
import { createFakeErrorReporter } from "./fake-error-reporter";
import { noopErrorReporter } from "./noop-error-reporter";

const REPORTERS: readonly (readonly [string, () => ErrorReporter])[] = [
  ["noop", () => noopErrorReporter],
  ["fake", () => createFakeErrorReporter()],
];

describe("the error reporters keep the contract of the port (E5.2, ADR 0080, D9)", () => {
  test.each(REPORTERS)(
    "%s takes an error, with or without context, and never throws",
    (_, make) => {
      const reporter = make();
      expect(() => {
        reporter.captureError(new Error("x"));
        reporter.captureError("not an error", { area: "test" });
      }).not.toThrow();
    },
  );

  test.each(REPORTERS)(
    "%s takes the native crash of the tests without throwing (the fake only counts it)",
    (_, make) => {
      const reporter = make();
      expect(() => {
        reporter.crashNatively();
      }).not.toThrow();
    },
  );

  test("the fake keeps what it was given, for the tests of the screens", () => {
    const fake = createFakeErrorReporter();
    const error = new Error("x");
    fake.captureError(error, { area: "a" });
    fake.crashNatively();
    expect(fake.captured()).toEqual([{ error, context: { area: "a" } }]);
    expect(fake.nativeCrashes()).toBe(1);
  });
});
