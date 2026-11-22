import type { CourtSessionTimeline, MatchStartedPayload } from "@sacou/match-engine";
import { ok } from "@sacou/volley-rules";
import { describe, expect, test } from "vitest";
import { NO_ROUND_END } from "../session/no-round-end.test.fixture";

import { SAMPLE_MATCH_ONE_SET } from "../dev/sample-match.data";
import { COURT_SESSION_ID } from "../session/court-harness.test.fixture";
import { runCourtReplay } from "../session/court-replay";
import { findResumableCourtSession } from "../session/resume-court";
import { courtSidesInverted } from "./court-sides";
import { selectCourtPhase, selectSetEnd, stateOfTimeline } from "./court-screen.selectors";
import { firstServerToSend } from "./set-end-view";
import {
  ROSTER,
  confirmSet,
  score,
  startScenario,
  withScoring,
  type Scenario,
} from "./screen-scenarios.test.fixture";

const A_SET = "a".repeat(25);
const B_SET = "b".repeat(25);

function inverted(scenario: Scenario, manual: boolean): boolean {
  return courtSidesInverted(stateOfTimeline(scenario.timeline()), manual);
}

function setEnd(scenario: Scenario) {
  const model = selectSetEnd(scenario.timeline(), ROSTER);
  if (model === null) throw new Error("no set to confirm");
  return model;
}

const TIE_BREAK_15 = { bestOf: 5, pointsPerSet: 25, tieBreakPoints: 15, winMargin: 2 } as const;
const TIE_BREAK_11 = { bestOf: 3, pointsPerSet: 25, tieBreakPoints: 11, winMargin: 2 } as const;

/** Plays the sets in order (each letter wins one) with the toss of the decider when asked. */
async function playSets(input: MatchStartedPayload, winners: string): Promise<Scenario> {
  const scenario = await startScenario(input);
  for (const winner of winners) {
    await score(scenario, winner === "a" ? A_SET : B_SET);
    await confirmSet(scenario, firstServerToSend(setEnd(scenario), "a"));
  }
  return scenario;
}

describe("the sides, with 'Inverter lados' combined (D5)", () => {
  test("the even sets swap: set 2 and set 4 of a best of five, and the manual flip undoes it", async () => {
    const scenario = await startScenario(withScoring(TIE_BREAK_15));
    const seen: boolean[][] = [];
    for (const winner of "aba") {
      seen.push([inverted(scenario, false), inverted(scenario, true)]);
      await score(scenario, winner === "a" ? A_SET : B_SET);
      await confirmSet(scenario);
    }
    seen.push([inverted(scenario, false), inverted(scenario, true)]);
    expect(seen).toEqual([
      [false, true],
      [true, false],
      [false, true],
      [true, false],
    ]);
  });

  test("the tie-break of 15 (set 5): 7 does not swap, 8 swaps, and the manual flip combines", async () => {
    const scenario = await playSets(withScoring(TIE_BREAK_15), "abab");
    expect(inverted(scenario, false)).toBe(false);
    await score(scenario, "aaaaaaabbbbbb");
    expect([inverted(scenario, false), inverted(scenario, true)]).toEqual([false, true]);
    await score(scenario, "a");
    expect([inverted(scenario, false), inverted(scenario, true)]).toEqual([true, false]);
  });

  test("the tie-break of 11 (set 3): 5 does not swap, 6 swaps, and the manual flip combines", async () => {
    const scenario = await playSets(withScoring(TIE_BREAK_11), "ab");
    await score(scenario, "bbbbbaaaaa");
    expect([inverted(scenario, false), inverted(scenario, true)]).toEqual([false, true]);
    await score(scenario, "b");
    expect([inverted(scenario, false), inverted(scenario, true)]).toEqual([true, false]);
  });

  test("the swap is the same whichever team reaches half first, and a lead past it stays", async () => {
    const scenario = await playSets(withScoring(TIE_BREAK_11), "ab");
    await score(scenario, "bbbbbb");
    expect(inverted(scenario, false)).toBe(true);
    await score(scenario, "aaaa");
    expect(inverted(scenario, false)).toBe(true);
  });
});

describe("firstServer is sent only with the confirmation that opens the deciding set", () => {
  test("in a best of five, sets 1 to 3 send nothing and the confirmation of 2–2 sends the toss", async () => {
    const scenario = await startScenario(withScoring(TIE_BREAK_15));
    const sent: (string | undefined)[] = [];
    for (const winner of "abab") {
      await score(scenario, winner === "a" ? A_SET : B_SET);
      const toSend = firstServerToSend(setEnd(scenario), "b");
      sent.push(toSend);
      await confirmSet(scenario, toSend);
    }
    expect(sent).toEqual([undefined, undefined, undefined, "b"]);
    const set = stateOfTimeline(scenario.timeline()).currentMatch?.currentSet;
    expect(set).toMatchObject({ setNumber: 5, servingTeam: "b" });
  });
});

describe("match-pending is resumed from the home", () => {
  test("a SetEnded of the decider with no MatchEnded opens the court again", async () => {
    const scenario = await startScenario(SAMPLE_MATCH_ONE_SET);
    await score(scenario, A_SET);
    await confirmSet(scenario);
    const snapshot = scenario.controller.getSnapshot();
    if (snapshot.status !== "ready") throw new Error("not ready");
    const cut = runCourtReplay(COURT_SESSION_ID, snapshot.events.slice(0, -1));
    if (!cut.ok) throw new Error("the log does not replay");
    const timeline: CourtSessionTimeline = cut.value;
    expect(selectCourtPhase(stateOfTimeline(timeline))).toBe("match-pending");

    const resumable = await findResumableCourtSession({
      ...NO_ROUND_END,
      log: scenario.harness.log,
      replayer: { replay: () => ok(timeline) },
    });
    expect(resumable).toBe(COURT_SESSION_ID);
  });

  test("and a finished match (MatchEnded stored) is not resumed", async () => {
    const scenario = await startScenario(SAMPLE_MATCH_ONE_SET);
    await score(scenario, A_SET);
    await confirmSet(scenario);
    expect(await findResumableCourtSession({ ...scenario.harness, ...NO_ROUND_END })).toBeNull();
  });
});
