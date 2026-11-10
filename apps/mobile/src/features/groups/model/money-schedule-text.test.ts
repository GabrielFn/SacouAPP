import { describe, expect, test } from "vitest";

import { formatCents, moneyFieldText, parseBrlToCents } from "./money-text";
import { formatTime, scheduleSummary, scheduleText, weekdayName } from "./schedule-text";

describe("parseBrlToCents", () => {
  test.each([
    ["10", 1000],
    ["10,50", 1050],
    ["10,5", 1050],
    ["R$ 10", 1000],
    ["R$10,00", 1000],
    ["R$ 1.000", 100000],
    ["1.000", 100000],
    ["", 0],
    ["  ", 0],
  ])("%j is %d cents", (text, cents) => {
    expect(parseBrlToCents(text)).toBe(cents);
  });

  test.each(["1.000,01", "-5", "abc", "1.5", "10,555", "1000,01", "R$ abc"])(
    "%j is refused",
    (text) => {
      expect(parseBrlToCents(text)).toBeNull();
    },
  );
});

describe("formatCents", () => {
  test.each([
    [1000, "R$ 10"],
    [1050, "R$ 10,50"],
    [5, "R$ 0,05"],
    [0, "R$ 0"],
    [100000, "R$ 1.000"],
    [3500, "R$ 35"],
  ])("%d is %j", (cents, text) => {
    expect(formatCents(cents)).toBe(text);
  });

  test("what is formatted is read back", () => {
    [0, 5, 1050, 3500, 100000].forEach((cents) => {
      expect(parseBrlToCents(formatCents(cents))).toBe(cents);
    });
  });

  test("a field is empty for zero", () => {
    expect(moneyFieldText(0)).toBe("");
    expect(moneyFieldText(1000)).toBe("R$ 10");
  });
});

describe("schedule text", () => {
  test("whole hours drop the minutes", () => {
    expect(formatTime("20:30")).toBe("20h30");
    expect(formatTime("20:00")).toBe("20h");
    expect(formatTime("08:05")).toBe("8h05");
  });

  test("weekdays by ISO number", () => {
    expect(weekdayName(2)).toBe("Terça");
    expect(scheduleText(2, "20:30")).toBe("Terça, 20h30");
    expect(scheduleSummary(2, "20:30")).toBe("toda terça 20h30");
    expect(scheduleSummary(6, "09:00")).toBe("todo sábado 9h");
  });
});
