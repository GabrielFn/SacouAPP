import { describe, expect, test } from "vitest";

import {
  batteryWarningReducer,
  initialBatteryWarning,
  type BatteryWarningAction,
  type BatteryWarningState,
} from "./battery-warning.reducer";

const reading = (level: number | null, charging = false): BatteryWarningAction => ({
  type: "reading-received",
  level,
  charging,
});

const run = (actions: readonly BatteryWarningAction[]): BatteryWarningState =>
  actions.reduce(batteryWarningReducer, initialBatteryWarning);

describe("batteryWarningReducer", () => {
  test("a level of 20% or more keeps watching", () => {
    expect(run([reading(0.2), reading(0.9)])).toEqual({ status: "watching" });
  });

  test("below 20% and unplugged shows, with the level that opened it", () => {
    expect(run([reading(0.18)])).toEqual({ status: "showing", level: 0.18 });
  });

  test("an unknown level never shows", () => {
    expect(run([reading(null)])).toEqual({ status: "watching" });
  });

  test("low but charging does not show", () => {
    expect(run([reading(0.1, true)])).toEqual({ status: "watching" });
  });

  test("a new reading while showing does not close it nor change the level", () => {
    expect(run([reading(0.18), reading(0.17), reading(0.5)])).toEqual({
      status: "showing",
      level: 0.18,
    });
  });

  test("plugging the charger closes it", () => {
    expect(run([reading(0.18), reading(0.18, true)])).toEqual({ status: "done" });
  });

  test("Entendi closes it", () => {
    expect(run([reading(0.18), { type: "dismissed" }])).toEqual({ status: "done" });
  });

  test("done is final: it never shows again", () => {
    expect(run([reading(0.18), { type: "dismissed" }, reading(0.05)])).toEqual({ status: "done" });
  });

  test("charging at 19% then unplugged at 18% shows", () => {
    expect(run([reading(0.19, true), reading(0.18, false)])).toEqual({
      status: "showing",
      level: 0.18,
    });
  });

  test("a court opened already at 10% shows on the first reading, and only once across the menu", () => {
    const shown = run([reading(0.1)]);
    expect(shown).toEqual({ status: "showing", level: 0.1 });
    // The menu and back remount the screen, not the layout that keeps this state: a new reading changes nothing.
    expect(batteryWarningReducer(shown, reading(0.1))).toEqual(shown);
    expect(run([reading(0.1), { type: "dismissed" }, reading(0.1)])).toEqual({ status: "done" });
  });

  test("dismissing before it showed changes nothing", () => {
    expect(run([{ type: "dismissed" }])).toEqual({ status: "watching" });
  });
});
