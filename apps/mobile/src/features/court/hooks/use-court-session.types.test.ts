import { describe, expect, test } from "vitest";

import { SAMPLE_MATCH_ONE_SET } from "../dev/sample-match.data";
import type { UseCourtSession } from "./use-court-session";

type ScreenCommand = Parameters<UseCourtSession["dispatch"]>[0];

describe("what a screen can dispatch", () => {
  test("starting a match is not among the commands of the hook (checked by tsc)", () => {
    // @ts-expect-error a screen must not start a match: only startCourtMatch does.
    const forbidden: ScreenCommand = { type: "start-match", input: SAMPLE_MATCH_ONE_SET };
    const allowed: readonly ScreenCommand[] = [
      { type: "score-point", team: "a" },
      { type: "undo" },
      { type: "confirm-set-end" },
    ];
    expect(forbidden.type).toBe("start-match");
    expect(allowed).toHaveLength(3);
  });
});
