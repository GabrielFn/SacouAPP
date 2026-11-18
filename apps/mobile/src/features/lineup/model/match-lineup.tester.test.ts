import { MIDDLE_BLOCKER_LINEUP_INDEXES, type MatchStartedPayload } from "@sacou/match-engine";
import { describe, expect, test } from "vitest";

import {
  SAMPLE_LIBERO_ID,
  SAMPLE_MATCH_BEST_OF_THREE,
  SAMPLE_MATCH_WITH_LIBERO,
  SAMPLE_ORANGE_LINEUP,
  SAMPLE_QUEUE_PLAYERS,
} from "../../court/dev/sample-match.data";
import { stateOfTimeline } from "../../court/model/court-screen.selectors";
import { ROSTER, startScenario } from "../../court/model/screen-scenarios.test.fixture";
import {
  draftsToSave,
  initialLineupEditorState,
  lineupEditorReducer,
  type LineupBase,
  type LineupEditorAction,
} from "./lineup-editor.reducer";
import { lineupView } from "./lineup-selectors";
import { matchLineupSource } from "./match-lineup-source";
import { saveMatchLineups } from "./save-match-lineups";

const BENCH_PLAYER = SAMPLE_QUEUE_PLAYERS[0] ?? "";
const NEXT_ZONE = 4;

const WITH_LIBERO_AND_BENCH: MatchStartedPayload = {
  ...SAMPLE_MATCH_WITH_LIBERO,
  queue: { players: SAMPLE_QUEUE_PLAYERS.slice(1), teams: [] },
  rotations: {
    a: {
      bench: [BENCH_PLAYER],
      libero: { memberId: SAMPLE_LIBERO_ID, replacedIndexes: MIDDLE_BLOCKER_LINEUP_INDEXES },
      lineup: SAMPLE_ORANGE_LINEUP,
      setterZone: 1,
      system: "5x1",
    },
    b: SAMPLE_MATCH_BEST_OF_THREE.rotations.b,
  },
  teams: {
    a: { memberIds: [...SAMPLE_ORANGE_LINEUP, SAMPLE_LIBERO_ID, BENCH_PLAYER] },
    b: SAMPLE_MATCH_BEST_OF_THREE.teams.b,
  },
};

type Scenario = Awaited<ReturnType<typeof startScenario>>;

function bases(scenario: Scenario): readonly LineupBase[] {
  const source = matchLineupSource(scenario.timeline(), ROSTER);
  if (source === null) throw new Error("no open match");
  return [source.teams.a.base, source.teams.b.base].flatMap((b) => (b === null ? [] : [b]));
}

function baseOf(scenario: Scenario, side: "a" | "b"): LineupBase {
  const base = bases(scenario).find((b) => b.side === side);
  if (base === undefined) throw new Error("no base");
  return base;
}

async function saveLibero(scenario: Scenario, memberId: string | null) {
  const action: LineupEditorAction = {
    type: "libero-chosen",
    base: baseOf(scenario, "a"),
    memberId,
  };
  const state = lineupEditorReducer(initialLineupEditorState("a"), action);
  return saveMatchLineups(scenario.controller.dispatch, draftsToSave(state, bases(scenario)));
}

describe("tester extras for E4.8 part 2", () => {
  test("libero off then on again in a team of 7 returns to the court and leaves the bench", async () => {
    const scenario = await startScenario(WITH_LIBERO_AND_BENCH);
    expect((await saveLibero(scenario, null)).ok).toBe(true);
    expect((await saveLibero(scenario, SAMPLE_LIBERO_ID)).ok).toBe(true);
    const team = stateOfTimeline(scenario.timeline()).currentMatch?.rotations.a;
    expect(team?.libero?.memberId).toBe(SAMPLE_LIBERO_ID);
    expect(team?.bench).toEqual([BENCH_PLAYER]);
    expect(team?.lineup).toEqual(SAMPLE_ORANGE_LINEUP);
  });

  test("both teams changed in one save: two LineupChanged, a then b, payload without system", async () => {
    const scenario = await startScenario();
    let state = lineupEditorReducer(initialLineupEditorState("a"), {
      type: "rotation-chosen",
      base: baseOf(scenario, "a"),
      zone: NEXT_ZONE,
    });
    state = lineupEditorReducer(state, { type: "tab-chosen", side: "b" });
    state = lineupEditorReducer(state, {
      type: "rotation-chosen",
      base: baseOf(scenario, "b"),
      zone: NEXT_ZONE,
    });
    const before = scenario.timeline().entries.length;
    expect(
      (await saveMatchLineups(scenario.controller.dispatch, draftsToSave(state, bases(scenario))))
        .ok,
    ).toBe(true);
    const written = scenario.timeline().entries.slice(before);
    expect(written.map(({ event }) => event.type)).toEqual(["LineupChanged", "LineupChanged"]);
    for (const { event } of written) {
      expect(Object.keys(event.payload).sort()).toEqual(
        ["bench", "libero", "lineup", "matchId", "setterZone", "team"].sort(),
      );
    }
  });

  test("a team of 6 offers no libero options and an empty draft saves nothing", async () => {
    const scenario = await startScenario();
    const source = matchLineupSource(scenario.timeline(), ROSTER);
    if (source === null) throw new Error("no open match");
    const view = lineupView(initialLineupEditorState("a"), source);
    expect(view.team?.libero.options).toEqual([]);
    expect(draftsToSave(initialLineupEditorState("a"), bases(scenario))).toEqual({});
  });
});
