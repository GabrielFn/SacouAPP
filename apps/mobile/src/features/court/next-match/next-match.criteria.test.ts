import { readFileSync } from "node:fs";

import {
  defaultGroupSettings,
  startMatch,
  type CourtSessionState,
  type FinishedMatch,
  type GroupSettings,
  type MemberId,
  type TeamSide,
  type TeamState,
} from "@sacou/match-engine";
import { describe, expect, test } from "vitest";

import type { CourtRoster } from "../ports/court-roster";
import { EMPTY_NEXT_MATCH_DRAFT } from "../ports/next-match-draft-store";
import { stateOfTimeline } from "../model/court-screen.selectors";
import {
  ROSTER as SAMPLE_ROSTER,
  score,
  startScenario,
  withScoring,
} from "../model/screen-scenarios.test.fixture";
import { exitRows, planExplanation } from "./match-end-selectors";
import { nextMatchModel } from "./next-match-model";
import { buildNextMatchStart } from "./next-match-start";

interface GoldenCase {
  readonly id: string;
  readonly input: { readonly state: CourtSessionState };
}

const GOLDEN: readonly GoldenCase[] = JSON.parse(
  readFileSync(
    new URL("../../../../../../packages/match-engine/golden/queue-plans.json", import.meta.url),
    "utf8",
  ),
) as readonly GoldenCase[];
const REVIEW = GOLDEN.find(({ id }) => id.startsWith("q1-review"))?.input.state;
if (REVIEW === undefined) throw new Error("the review case is missing from the golden");

const NAMES_ROSTER: CourtRoster = {
  nameOf: (memberId: MemberId) => memberId.slice(-2),
  teamAppearance: (_matchId, side: TeamSide) =>
    side === "a" ? { label: "Laranja", color: "orange" } : { label: "Azul", color: "blue" },
};

function settings(): GroupSettings {
  const base = defaultGroupSettings();
  return {
    ...base,
    queue: { ...base.queue, enabled: true },
    rotation: { ...base.rotation, enabled: true, system: "5x1" },
  };
}

function lastOf(state: CourtSessionState): FinishedMatch {
  const last = state.finishedMatches.at(-1);
  if (last === undefined) throw new Error("no finished match");
  return last;
}

/** The review with Azul (the loser) ending the match with the setter in `zone`. */
function reviewAt(zone: TeamState["setterZone"]): CourtSessionState {
  const match = lastOf(REVIEW as CourtSessionState);
  const patched: FinishedMatch = {
    ...match,
    rotations: {
      ...match.rotations,
      b: match.rotations.b && { ...match.rotations.b, setterZone: zone },
    },
  };
  const state = REVIEW as CourtSessionState;
  return { ...state, finishedMatches: [...state.finishedMatches.slice(0, -1), patched] };
}

function slotsOfEntering(zone: TeamState["setterZone"]): number[] {
  const state = reviewAt(zone);
  const planned = nextMatchModel({
    state,
    settings: settings(),
    confirmed: [],
    draft: EMPTY_NEXT_MATCH_DRAFT,
    roster: NAMES_ROSTER,
  });
  if (planned.kind !== "planned") throw new Error(`no plan: ${planned.kind}`);
  return exitRows(lastOf(state), planned.plan, NAMES_ROSTER).entering.map(({ detail }) =>
    Number((detail ?? "").replace("posição ", "")),
  );
}

describe("who comes in takes the slot of the court, with the setter in any zone", () => {
  const SLOTS = 6;
  const wrap = (slot: number) => ((((slot - 1) % SLOTS) + SLOTS) % SLOTS) + 1;

  test("each zone of the setter moves every entering player by the same number of slots", () => {
    const base = slotsOfEntering(6);
    expect(base).toEqual([1, 5]);
    for (const zone of [1, 2, 3, 4, 5, 6] as const) {
      expect(slotsOfEntering(zone)).toEqual(base.map((slot) => wrap(slot + zone - 6)));
    }
  });
});

describe("an ended match with no winner (a full tie)", () => {
  test("a manual end with the sets and the score tied has no winner, nobody leaves, same teams", async () => {
    const scenario = await startScenario(
      withScoring({ bestOf: 3, pointsPerSet: 25, tieBreakPoints: 15, winMargin: 2 }),
    );
    await score(scenario, "abab");
    const result = await scenario.controller.dispatch({ type: "end-match-manually" });
    expect(result.ok).toBe(true);
    const state = stateOfTimeline(scenario.timeline());
    expect(lastOf(state).winner).toBeNull();
    expect(lastOf(state).endReason).toBe("manual");

    const planned = nextMatchModel({
      state,
      settings: settings(),
      confirmed: [],
      draft: EMPTY_NEXT_MATCH_DRAFT,
      roster: SAMPLE_ROSTER,
    });
    if (planned.kind !== "planned") throw new Error(`no plan: ${planned.kind}`);
    expect(planned.canConfirm).toBe(true);
    expect(planned.plan.exits).toEqual([]);
    expect(planned.plan.enteringTeams).toEqual([]);
    expect(planned.plan.winnerLeaving).toBeNull();
    expect(planned.plan.queue).toEqual(state.queue);
    expect(planned.plan.teams).toEqual(lastOf(state).teams);
    expect(
      planExplanation({
        state,
        match: planned.match,
        plan: planned.plan,
        criterion: settings().queue.exitCriterion,
        fixedCount: false,
        roster: SAMPLE_ROSTER,
      }),
    ).toBe("Sem vencedor: ninguém sai.");

    const payload = buildNextMatchStart({
      plan: planned.plan,
      finished: planned.match,
      settings: settings(),
      matchId: "f0000000-0000-4000-8000-00000000aaaa",
      firstServer: "a",
      positionOf: () => null,
    });
    expect(startMatch(state, payload).ok).toBe(true);
  });
});
