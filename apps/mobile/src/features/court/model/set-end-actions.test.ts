import { describe, expect, test, vi } from "vitest";

import type { SetEndModel } from "./court-screen.types";
import { buildSetEndActions } from "./set-end-actions";

const LABELS = { confirm: "Confirmar", serves: (team: string) => `${team} saca` };
const TOUCH_EVENT = { nativeEvent: { locationX: 1 } };

function model(needsFirstServer: boolean): SetEndModel {
  return {
    setNumber: 1,
    winnerLabel: "Laranja",
    scores: { a: { label: "Laranja", score: 25 }, b: { label: "Azul", score: 20 } },
    needsFirstServer,
  };
}

/** Presses like React Native: the touch event comes as the first argument. */
function pressWithEvent(action: { readonly onPress: unknown }): void {
  (action.onPress as (event: unknown) => void)(TOUCH_EVENT);
}

describe("buildSetEndActions", () => {
  test("confirming does not pass the touch event as the first server", () => {
    const confirm = vi.fn();
    const actions = buildSetEndActions(model(false), LABELS, confirm);
    expect(actions).toHaveLength(1);
    actions.forEach(pressWithEvent);
    expect(confirm).toHaveBeenCalledOnce();
    expect(confirm.mock.calls[0]).toEqual([]);
  });

  test("the toss has one button per team, each with its own side", () => {
    const confirm = vi.fn();
    const actions = buildSetEndActions(model(true), LABELS, confirm);
    expect(actions.map(({ label }) => label)).toEqual(["Laranja saca", "Azul saca"]);
    actions.forEach(pressWithEvent);
    expect(confirm.mock.calls).toEqual([["a"], ["b"]]);
  });
});
