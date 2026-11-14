import { defaultGroupSettings, parseGroupSettings } from "@sacou/match-engine";
import { describe, expect, test } from "vitest";

import {
  changedLeaves,
  draftOf,
  FIXED_EXIT_RANGE,
  queueRuleLayer,
  queueRuleSummary,
  withDraft,
  WINNER_WINS_RANGE,
  type QueueRuleDraft,
} from "./queue-rule";
import {
  initialQueueRuleState,
  queueRuleReducer,
  type QueueRuleAction,
} from "./queue-rule.reducer";

const saved = defaultGroupSettings();
const base = draftOf(saved);

function run(...actions: readonly QueueRuleAction[]): QueueRuleDraft {
  return actions.reduce(queueRuleReducer, initialQueueRuleState(base)).draft;
}

describe("the summary on screen 18", () => {
  test.each([
    [
      { exitMode: "automatic", winnerExitEnabled: true, winnerExitWins: 3 },
      "Automático · vencedor sai após 3",
    ],
    [{ exitMode: "whole-team", winnerExitEnabled: false }, "Sempre o time inteiro"],
    [{ exitMode: "fixed-count", fixedExitCount: 2, winnerExitEnabled: false }, "Número fixo: 2"],
    [
      { exitMode: "fixed-count", fixedExitCount: 4, winnerExitEnabled: true, winnerExitWins: 5 },
      "Número fixo: 4 · vencedor sai após 5",
    ],
  ] as const)("%j reads %s", (change, text) => {
    expect(queueRuleSummary({ ...base, ...change })).toBe(text);
  });
});

describe("the reducer of screen 18a", () => {
  test("choosing the mode changes only the mode", () => {
    expect(run({ type: "mode-selected", mode: "fixed-count" })).toEqual({
      ...base,
      exitMode: "fixed-count",
    });
  });

  test("the steppers follow the catalog range and stop at its limits", () => {
    const top = run({ type: "fixed-count-stepped", delta: FIXED_EXIT_RANGE.max * 2 });
    expect(top.fixedExitCount).toBe(FIXED_EXIT_RANGE.max);
    expect(run({ type: "fixed-count-stepped", delta: -100 }).fixedExitCount).toBe(
      FIXED_EXIT_RANGE.min,
    );
    expect(run({ type: "winner-wins-stepped", delta: 100 }).winnerExitWins).toBe(
      WINNER_WINS_RANGE.max,
    );
    expect(run({ type: "winner-wins-stepped", delta: -100 }).winnerExitWins).toBe(
      WINNER_WINS_RANGE.min,
    );
  });

  test("turning the winner off keeps the number", () => {
    const draft = run(
      { type: "winner-toggled", enabled: true },
      { type: "winner-wins-stepped", delta: 2 },
      { type: "winner-toggled", enabled: false },
    );
    expect(draft.winnerExitEnabled).toBe(false);
    expect(draft.winnerExitWins).toBe(base.winnerExitWins + 2);
  });

  test("a refusal stays until the next change", () => {
    const failed = queueRuleReducer(initialQueueRuleState(base), {
      type: "save-failed",
      message: "x",
    });
    expect(failed.message).toBe("x");
    expect(queueRuleReducer(failed, { type: "winner-toggled", enabled: true }).message).toBeNull();
  });
});

describe("saving the rule", () => {
  test("nothing changed means no request", () => {
    expect(queueRuleLayer(saved, base)).toBeNull();
  });

  test("the request carries only the changed leaves, all in one layer", () => {
    const draft = { ...base, exitMode: "fixed-count" as const, winnerExitEnabled: true };
    expect(changedLeaves(saved, draft).map(([path]) => path)).toEqual([
      "queue.exitMode",
      "queue.winnerExitEnabled",
    ]);
    expect(queueRuleLayer(saved, draft)).toEqual({
      schemaVersion: 1,
      queue: { exitMode: "fixed-count", winnerExitEnabled: true },
    });
  });

  test("every draft the reducer can reach passes the parser of the engine", () => {
    const draft = run(
      { type: "mode-selected", mode: "fixed-count" },
      { type: "fixed-count-stepped", delta: 100 },
      { type: "winner-toggled", enabled: true },
      { type: "winner-wins-stepped", delta: 100 },
    );
    expect(parseGroupSettings(withDraft(saved, draft)).ok).toBe(true);
  });
});
