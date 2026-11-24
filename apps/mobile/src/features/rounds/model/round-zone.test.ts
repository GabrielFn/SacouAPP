import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

import { dropInOpensPhrase } from "./round-clock";

/** Two rounds in zones that differ from each other, so no device zone can read both right (ADR 0054). */
describe("the phrase of the drop-in window follows the zone of the round, not the phone", () => {
  // A phone in Brazil: the CI runs in UTC, where a read in the zone of the phone would look right.
  beforeAll(() => {
    vi.stubEnv("TZ", "America/Sao_Paulo");
  });
  afterAll(() => {
    vi.unstubAllEnvs();
  });

  const tokyo = { localDate: "2026-11-06", localTime: "19:00", startsAt: "2026-11-06T10:00:00Z" };
  const manaus = { localDate: "2026-11-06", localTime: "19:00", startsAt: "2026-11-06T23:00:00Z" };
  const at = (iso: string) => Date.parse(iso);

  test("UTC+9: 07h of the round zone, read from the evening before there, is 'amanhã'", () => {
    expect(dropInOpensPhrase(tokyo, "2026-11-05T22:00:00Z", at("2026-11-05T14:00:00Z"))).toBe(
      "amanhã, às 7h",
    );
  });

  test("UTC+9: 01h in Tokyo is already the day of the window, though the phone still has the day before", () => {
    expect(dropInOpensPhrase(tokyo, "2026-11-05T22:00:00Z", at("2026-11-05T16:00:00Z"))).toBe(
      "hoje, às 7h",
    );
  });

  test("UTC-4: the same wall time reads the same hours", () => {
    expect(dropInOpensPhrase(manaus, "2026-11-06T11:00:00Z", at("2026-11-06T09:00:00Z"))).toBe(
      "hoje, às 7h",
    );
  });

  test("crossing midnight in the zone of the round changes the day: 0h30 of Friday", () => {
    expect(dropInOpensPhrase(tokyo, "2026-11-05T15:30:00Z", at("2026-11-03T00:00:00Z"))).toBe(
      "na sexta, 6/11, às 0h30",
    );
  });
});

describe("dropInOpensPhrase", () => {
  const round = {
    localDate: "2026-11-30",
    localTime: "20:00",
    startsAt: "2026-11-30T23:00:00Z",
  };
  const at = (iso: string) => Date.parse(iso);

  test("the same day, the next day", () => {
    expect(dropInOpensPhrase(round, "2026-11-24T23:00:00Z", at("2026-11-24T12:00:00Z"))).toBe(
      "hoje, às 20h",
    );
    expect(dropInOpensPhrase(round, "2026-11-24T23:00:00Z", at("2026-11-23T12:00:00Z"))).toBe(
      "amanhã, às 20h",
    );
  });

  test("a Tuesday three days ahead carries the weekday and the date", () => {
    expect(dropInOpensPhrase(round, "2026-11-24T23:00:00Z", at("2026-11-21T12:00:00Z"))).toBe(
      "na terça, 24/11, às 20h",
    );
  });

  test("Saturday and Sunday take 'no'", () => {
    expect(dropInOpensPhrase(round, "2026-11-28T23:00:00Z", at("2026-11-24T12:00:00Z"))).toBe(
      "no sábado, 28/11, às 20h",
    );
    expect(dropInOpensPhrase(round, "2026-11-29T23:00:00Z", at("2026-11-24T12:00:00Z"))).toBe(
      "no domingo, 29/11, às 20h",
    );
  });

  test("ten days ahead still says the date", () => {
    expect(dropInOpensPhrase(round, "2026-11-24T23:00:00Z", at("2026-11-14T12:00:00Z"))).toBe(
      "na terça, 24/11, às 20h",
    );
  });

  test("minutes are kept, and 1h takes the singular", () => {
    expect(dropInOpensPhrase(round, "2026-11-24T23:30:00Z", at("2026-11-24T12:00:00Z"))).toBe(
      "hoje, às 20h30",
    );
    expect(dropInOpensPhrase(round, "2026-11-24T04:00:00Z", at("2026-11-24T03:30:00Z"))).toBe(
      "hoje, à 1h",
    );
  });

  test("an unreadable instant gives an empty phrase", () => {
    expect(dropInOpensPhrase(round, "not a date", 0)).toBe("");
  });
});
