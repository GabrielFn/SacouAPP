import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

import { dropInOpensLabel } from "./round-clock";

/** Two rounds in zones that differ from each other, so no device zone can read both right (ADR 0054). */
describe("the label of the drop-in window follows the zone of the round, not the phone", () => {
  // A phone in Brazil: the CI runs in UTC, where a read in the zone of the phone would look right.
  beforeAll(() => {
    vi.stubEnv("TZ", "America/Sao_Paulo");
  });
  afterAll(() => {
    vi.unstubAllEnvs();
  });

  const tokyo = { localDate: "2026-11-06", localTime: "19:00", startsAt: "2026-11-06T10:00:00Z" };
  const manaus = { localDate: "2026-11-06", localTime: "19:00", startsAt: "2026-11-06T23:00:00Z" };

  test("UTC+9: 12h before is the morning of the same day in the zone of the round", () => {
    expect(dropInOpensLabel(tokyo, "2026-11-05T22:00:00Z")).toBe("sex, 7h");
  });

  test("UTC-4: the same wall time reads the same hours", () => {
    expect(dropInOpensLabel(manaus, "2026-11-06T11:00:00Z")).toBe("sex, 7h");
  });

  test("crossing midnight in the zone of the round changes the weekday", () => {
    expect(dropInOpensLabel(tokyo, "2026-11-05T15:30:00Z")).toBe("sex, 0h30");
  });
});
