import { describe, expect, test } from "vitest";

import { strings } from "../../../strings/pt-BR";
import {
  INITIAL_TAKEOVER_STATE,
  isBusy,
  takeoverReducer,
  type TakeoverAction,
  type TakeoverState,
} from "./takeover.reducer";

const TOTAL = 12;

function run(actions: readonly TakeoverAction[]): TakeoverState {
  return actions.reduce(takeoverReducer, INITIAL_TAKEOVER_STATE);
}

describe("takeoverReducer (screen 09a, D5)", () => {
  test("confirm, take over, import page by page, done", () => {
    const importing = run([
      { type: "confirmed" },
      { type: "taken-over", eventsToRead: TOTAL },
      { type: "page-imported", imported: 5 },
    ]);
    expect(importing).toEqual({ status: "importing", imported: 5, total: TOTAL });
    expect(isBusy(importing)).toBe(true);
    expect(takeoverReducer(importing, { type: "imported", courtSessionId: "c" })).toEqual({
      status: "done",
      courtSessionId: "c",
    });
  });

  test("the progress never passes the total", () => {
    expect(
      run([
        { type: "confirmed" },
        { type: "taken-over", eventsToRead: TOTAL },
        { type: "page-imported", imported: TOTAL + 1 },
      ]),
    ).toMatchObject({ imported: TOTAL });
  });

  test("stream-changed goes back to the confirmation, saying so", () => {
    expect(run([{ type: "confirmed" }, { type: "stream-changed" }])).toEqual({
      status: "confirming",
      streamChanged: true,
    });
  });

  test("a failure while importing waits for 'Tentar de novo', which starts over", () => {
    const failed = run([
      { type: "confirmed" },
      { type: "taken-over", eventsToRead: TOTAL },
      { type: "failed", reason: "import-invalid" },
    ]);
    expect(failed).toEqual({ status: "failed", reason: "import-invalid" });
    expect(isBusy(failed)).toBe(false);
    expect(takeoverReducer(failed, { type: "retried" })).toEqual(INITIAL_TAKEOVER_STATE);
  });

  test("actions out of their step change nothing (a second tap, a late page)", () => {
    const taking = run([{ type: "confirmed" }]);
    expect(takeoverReducer(taking, { type: "confirmed" })).toBe(taking);
    expect(takeoverReducer(INITIAL_TAKEOVER_STATE, { type: "imported", courtSessionId: "c" })).toBe(
      INITIAL_TAKEOVER_STATE,
    );
    expect(takeoverReducer(INITIAL_TAKEOVER_STATE, { type: "page-imported", imported: 1 })).toBe(
      INITIAL_TAKEOVER_STATE,
    );
    expect(takeoverReducer(INITIAL_TAKEOVER_STATE, { type: "retried" })).toBe(
      INITIAL_TAKEOVER_STATE,
    );
  });
});

describe("texts of 09c (D6)", () => {
  test("the title is singular for one point", () => {
    expect(strings.court.refused.title(1)).toBe("1 ponto não entrou");
    expect(strings.court.refused.title(3)).toBe("3 pontos não entraram");
    expect(strings.court.clockTime(9, 5)).toBe("09h05");
  });
});
