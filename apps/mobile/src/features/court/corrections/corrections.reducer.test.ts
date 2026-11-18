import { describe, expect, test } from "vitest";

import {
  correctionsReducer,
  INITIAL_CORRECTIONS,
  type CorrectionsState,
} from "./corrections.reducer";

describe("the state of screen 24", () => {
  test("picks a point, and picking it again clears it", () => {
    const picked = correctionsReducer(INITIAL_CORRECTIONS, { type: "point-tapped", eventId: "e1" });
    expect(picked.selected).toBe("e1");
    expect(correctionsReducer(picked, { type: "point-tapped", eventId: "e1" }).selected).toBeNull();
  });

  test("picking another point moves the pick", () => {
    const first = correctionsReducer(INITIAL_CORRECTIONS, { type: "point-tapped", eventId: "e1" });
    expect(correctionsReducer(first, { type: "point-tapped", eventId: "e2" }).selected).toBe("e2");
  });

  test("opening the sheet of Girar drops the pick, and a pick closes the sheet", () => {
    const picked: CorrectionsState = { ...INITIAL_CORRECTIONS, selected: "e1" };
    const open = correctionsReducer(picked, { type: "shift-opened" });
    expect(open).toMatchObject({ selected: null, sheet: "shift" });
    expect(correctionsReducer(open, { type: "point-tapped", eventId: "e2" }).sheet).toBe("none");
  });

  test("chooses the team and closes", () => {
    const open = correctionsReducer(INITIAL_CORRECTIONS, { type: "shift-opened" });
    const team = correctionsReducer(open, { type: "shift-team-chosen", team: "b" });
    expect(team.shiftTeam).toBe("b");
    expect(correctionsReducer(team, { type: "shift-closed" })).toMatchObject({
      sheet: "none",
      shiftTeam: "b",
      refusal: null,
    });
  });

  test("clearing the selection keeps the rest", () => {
    const state: CorrectionsState = {
      selected: "e1",
      sheet: "none",
      shiftTeam: "b",
      refusal: null,
    };
    expect(correctionsReducer(state, { type: "selection-cleared" })).toEqual({
      selected: null,
      sheet: "none",
      shiftTeam: "b",
      refusal: null,
    });
  });
});

describe("the refusal of screen 24", () => {
  test("a refusal stays until a point is picked or the sheet of Girar opens", () => {
    const refused = correctionsReducer(INITIAL_CORRECTIONS, {
      type: "command-refused",
      text: "Nada mudou.",
    });
    expect(refused.refusal).toBe("Nada mudou.");
    expect(correctionsReducer(refused, { type: "point-tapped", eventId: "e1" }).refusal).toBeNull();
    expect(correctionsReducer(refused, { type: "shift-opened" }).refusal).toBeNull();
    expect(correctionsReducer(refused, { type: "command-accepted" }).refusal).toBeNull();
  });
});
