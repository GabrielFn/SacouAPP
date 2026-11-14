import { describe, expect, test } from "vitest";

import { formatTime, scheduleSummary, scheduleText, weekdayName } from "./schedule-text";

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
