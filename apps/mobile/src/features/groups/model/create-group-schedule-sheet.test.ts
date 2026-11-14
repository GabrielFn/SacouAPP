import { describe, expect, test } from "vitest";

import { createGroupReducer, createInitialState } from "./create-group.reducer";
import { templateOrigin } from "./custom-blocks";

describe("the schedule sheet of screen 05", () => {
  test("confirming stores the draft and closes the sheet", () => {
    const opened = createGroupReducer(createInitialState(templateOrigin("racha-organizado")), {
      type: "schedule-opened",
      draft: { weekday: 4, time: "19:00" },
    });
    const confirmed = createGroupReducer(opened, { type: "schedule-confirmed" });
    expect(confirmed.scheduleSheet).toBeNull();
    expect(confirmed).toMatchObject({ scheduleWeekday: 4, scheduleTime: "19:00" });
  });
});
