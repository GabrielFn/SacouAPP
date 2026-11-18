import {
  getServingPlayer,
  MIDDLE_BLOCKER_LINEUP_INDEXES,
  type MatchStartedPayload,
  type TeamSide,
} from "@sacou/match-engine";
import { describe, expect, test } from "vitest";

import {
  SAMPLE_LIBERO_ID,
  SAMPLE_MATCH_BEST_OF_THREE,
  SAMPLE_MATCH_WITH_LIBERO,
  SAMPLE_ORANGE_LINEUP,
  SAMPLE_QUEUE_PLAYERS,
} from "../../court/dev/sample-match.data";
import { isMenuScreenReady } from "../../court/model/menu-selectors";
import { stateOfTimeline } from "../../court/model/court-screen.selectors";
import {
  confirmSet,
  ROSTER,
  score,
  startScenario,
  type Scenario,
} from "../../court/model/screen-scenarios.test.fixture";
import { lineupStrings as texts } from "../../../strings/lineup.pt-BR";
import {
  draftsToSave,
  initialLineupEditorState,
  isDraftStale,
  lineupEditorReducer,
  type LineupBase,
  type LineupEditorAction,
  type LineupEditorState,
} from "./lineup-editor.reducer";
import { lineupRefusalText } from "./lineup-refusal";
import { lineupView } from "./lineup-selectors";
import type { LineupSource } from "./lineup-source";
import { INITIAL_MATCH_LINEUP, matchLineupReducer } from "./match-lineup.reducer";
import { hasLineupToEdit, matchLineupSource, teamOfParam } from "./match-lineup-source";
import { saveMatchLineups } from "./save-match-lineups";
import { toAllocation } from "./to-allocation";

const BENCH_PLAYER = SAMPLE_QUEUE_PLAYERS[0] ?? "";
const NEXT_ZONE = 4;
const SET_POINTS = 25;

function sourceOf(scenario: Scenario): LineupSource {
  const source = matchLineupSource(scenario.timeline(), ROSTER);
  if (source === null) throw new Error("no open match");
  return source;
}

function baseOf(scenario: Scenario, side: TeamSide = "a"): LineupBase {
  const base = sourceOf(scenario).teams[side].base;
  if (base === null) throw new Error("no rotation");
  return base;
}

function edit(
  scenario: Scenario,
  ...actions: readonly ((base: LineupBase) => LineupEditorAction)[]
): LineupEditorState {
  return actions.reduce(
    (state, action) => lineupEditorReducer(state, action(baseOf(scenario, state.tab))),
    initialLineupEditorState("a"),
  );
}

function save(scenario: Scenario, state: LineupEditorState) {
  const source = sourceOf(scenario);
  const bases = [source.teams.a.base, source.teams.b.base].flatMap((b) => (b === null ? [] : [b]));
  return saveMatchLineups(scenario.controller.dispatch, draftsToSave(state, bases));
}

function teamA(scenario: Scenario) {
  return stateOfTimeline(scenario.timeline()).currentMatch?.rotations.a ?? null;
}

const tap =
  (memberId: string) =>
  (base: LineupBase): LineupEditorAction => ({ type: "player-tapped", base, memberId });

const rotation =
  (zone: 1 | 2 | 3 | 4 | 5 | 6) =>
  (base: LineupBase): LineupEditorAction => ({ type: "rotation-chosen", base, zone });

const libero =
  (memberId: string | null) =>
  (base: LineupBase): LineupEditorAction => ({ type: "libero-chosen", base, memberId });

/** Laranja with a libero and one more on the bench: 8 in the team. */
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

const [FIRST = "", SECOND = ""] = SAMPLE_ORANGE_LINEUP;

describe("change-lineup in the match (E4.8, D7)", () => {
  test("toAllocation carries exactly the four fields, never the system", () => {
    const allocation = toAllocation({
      bench: [BENCH_PLAYER],
      libero: null,
      lineup: SAMPLE_ORANGE_LINEUP,
      setterZone: 1,
      system: "6x2",
    });
    expect(Object.keys(allocation).sort()).toEqual(["bench", "libero", "lineup", "setterZone"]);
  });

  test("a swap writes one LineupChanged, the order changes and the score stays", async () => {
    const scenario = await startScenario();
    await score(scenario, "ab");
    const events = scenario.timeline().entries.length;
    const result = await save(scenario, edit(scenario, tap(FIRST), tap(SECOND)));
    expect(result.ok).toBe(true);
    const timeline = scenario.timeline();
    expect(timeline.entries).toHaveLength(events + 1);
    expect(timeline.entries.at(-1)?.event.type).toBe("LineupChanged");
    expect(teamA(scenario)?.lineup.slice(0, 2)).toEqual([SECOND, FIRST]);
    expect(stateOfTimeline(timeline).currentMatch?.currentSet?.score).toEqual({ a: 1, b: 1 });
  });

  test("another rotation of the team that serves changes who serves, and undo brings it back", async () => {
    const scenario = await startScenario();
    const before = teamA(scenario);
    const view = lineupView(edit(scenario, rotation(NEXT_ZONE)), sourceOf(scenario));
    expect(view.team?.serverChange).not.toBeNull();
    await save(scenario, edit(scenario, rotation(NEXT_ZONE)));
    const after = teamA(scenario);
    expect(after?.setterZone).toBe(NEXT_ZONE);
    expect(getServingPlayer(after?.lineup ?? [], NEXT_ZONE)).not.toBe(
      getServingPlayer(before?.lineup ?? [], before?.setterZone ?? 1),
    );
    expect((await scenario.controller.dispatch({ type: "undo" })).ok).toBe(true);
    expect(teamA(scenario)).toEqual(before);
  });

  test("both teams changed: one event each, in tab order", async () => {
    const scenario = await startScenario();
    const state = edit(
      scenario,
      rotation(NEXT_ZONE),
      () => ({ type: "tab-chosen", side: "b" }),
      rotation(NEXT_ZONE),
    );
    const events = scenario.timeline().entries.length;
    expect((await save(scenario, state)).ok).toBe(true);
    const written = scenario.timeline().entries.slice(events);
    expect(written.map(({ event }) => event.payload)).toMatchObject([{ team: "a" }, { team: "b" }]);
  });

  test("the match ended under the screen: refused with its words", async () => {
    const scenario = await startScenario();
    const state = edit(scenario, rotation(NEXT_ZONE));
    const drafts = draftsToSave(state, [baseOf(scenario)]);
    await scenario.controller.dispatch({ type: "end-match-manually" });
    const result = await saveMatchLineups(scenario.controller.dispatch, drafts);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(lineupRefusalText(result.error)).toBe("A partida já terminou.");
    expect(matchLineupSource(scenario.timeline(), ROSTER)).toBeNull();
  });

  test("the other refusals have the lineup's words, and an unknown one the court's", () => {
    expect(lineupRefusalText({ code: "refused", reason: "rotation-off" })).toBe(
      "Esse time joga sem rotação.",
    );
    expect(lineupRefusalText({ code: "refused", reason: "invalid-payload" })).toBe(
      "Não deu para salvar. Confira a escalação.",
    );
    expect(lineupRefusalText({ code: "not-ready" })).toBe(
      "Não foi possível fazer isso agora. Nada mudou.",
    );
  });

  test("a draft back to the base turns Salvar off", async () => {
    const scenario = await startScenario();
    const state = edit(scenario, rotation(NEXT_ZONE), rotation(1));
    expect(lineupView(state, sourceOf(scenario)).canSave).toBe(false);
  });
});

describe("the base moved under the draft (D3, D7)", () => {
  test("a new event in the log makes the draft stale: the screen tells, shows the base, saves nothing", async () => {
    const scenario = await startScenario();
    const state = edit(scenario, rotation(NEXT_ZONE));
    expect(lineupView(state, sourceOf(scenario)).canSave).toBe(true);
    await score(scenario, "a");
    const source = sourceOf(scenario);
    const base = baseOf(scenario);
    const view = lineupView(state, source);
    expect(isDraftStale(state, base)).toBe(true);
    expect(view.team?.stale).toBe(true);
    expect(view.canSave).toBe(false);
    expect(view.team?.rotation?.options.find((option) => option.checked)?.value).toBe(1);
  });
});

describe("the libero and the bench in a match (D5, D6)", () => {
  test("a team of 6 has no libero to choose", async () => {
    const scenario = await startScenario();
    const view = lineupView(initialLineupEditorState("a"), sourceOf(scenario));
    expect(view.team?.libero).toEqual({
      label: "Líbero do Laranja",
      options: [],
      note: "Sem líbero: o time tem 6.",
    });
  });

  test("turning the libero off sends it to the end of the bench, and it can come back", async () => {
    const scenario = await startScenario(WITH_LIBERO_AND_BENCH);
    const state = edit(scenario, libero(null));
    const view = lineupView(state, sourceOf(scenario));
    expect(view.team?.benchLine).toContain("Banco:");
    expect(view.team?.libero.options.map((option) => option.value)).toEqual([
      null,
      BENCH_PLAYER,
      SAMPLE_LIBERO_ID,
    ]);
    await save(scenario, state);
    expect(teamA(scenario)).toMatchObject({
      libero: null,
      bench: [BENCH_PLAYER, SAMPLE_LIBERO_ID],
    });
    expect(scenario.timeline().entries.at(-1)?.event.payload).toMatchObject({ libero: null });
  });

  test("another libero from the bench: the old one goes to the end of the bench", async () => {
    const scenario = await startScenario(WITH_LIBERO_AND_BENCH);
    await save(scenario, edit(scenario, libero(BENCH_PLAYER)));
    expect(teamA(scenario)).toMatchObject({
      libero: { memberId: BENCH_PLAYER, replacedIndexes: MIDDLE_BLOCKER_LINEUP_INDEXES },
      bench: [SAMPLE_LIBERO_ID],
      lineup: SAMPLE_ORANGE_LINEUP,
    });
  });

  test("a tap on the libero's chip selects nobody", async () => {
    const scenario = await startScenario(SAMPLE_MATCH_WITH_LIBERO);
    expect(edit(scenario, tap(SAMPLE_LIBERO_ID)).selection).toBeNull();
  });
});

describe("between sets (D7)", () => {
  test("no server on the court, the change holds for the next set", async () => {
    const scenario = await startScenario();
    await score(scenario, "a".repeat(SET_POINTS));
    const state = edit(scenario, rotation(NEXT_ZONE));
    const view = lineupView(state, sourceOf(scenario));
    expect(view.team?.courtCaption).toBe(texts.nextSet);
    expect(view.team?.phaseLabel).toBe(texts.betweenSets);
    expect(view.team?.chips.some((chip) => chip.isServer)).toBe(false);
    expect(view.team?.order.some((cell) => cell.isServer)).toBe(false);
    expect(view.team?.serverChange).toBeNull();
    expect((await save(scenario, state)).ok).toBe(true);
    await confirmSet(scenario);
    const match = stateOfTimeline(scenario.timeline()).currentMatch;
    expect(match?.currentSet?.setNumber).toBe(2);
    expect(match?.rotations.a?.setterZone).toBe(NEXT_ZONE);
  });

  test("in play the court says No saque", async () => {
    const scenario = await startScenario();
    const view = lineupView(initialLineupEditorState("a"), sourceOf(scenario));
    expect(view.team?.courtCaption).toBe(texts.atServe);
    expect(view.team?.phaseLabel).toBe("Laranja sacando");
  });
});

describe("the route and the menu (D7)", () => {
  test("the team of the route is a or b, anything else opens A", () => {
    expect(teamOfParam("b")).toBe("b");
    expect(teamOfParam("a")).toBe("a");
    expect(teamOfParam("c")).toBe("a");
    expect(teamOfParam(["b"])).toBe("a");
    expect(teamOfParam(undefined)).toBe("a");
  });

  test("the menu has Escalação only with a team that rotates", async () => {
    expect(isMenuScreenReady("lineup")).toBe(true);
    expect(hasLineupToEdit((await startScenario()).timeline())).toBe(true);
    const off = await startScenario({
      ...SAMPLE_MATCH_BEST_OF_THREE,
      rotations: { a: null, b: null },
    });
    expect(hasLineupToEdit(off.timeline())).toBe(false);
  });

  test("Voltar with a draft asks first; Salvar waits and says why it did nothing", () => {
    const asked = matchLineupReducer(INITIAL_MATCH_LINEUP, { type: "discard-asked" });
    expect(asked.confirmingDiscard).toBe(true);
    expect(matchLineupReducer(asked, { type: "discard-cancelled" }).confirmingDiscard).toBe(false);
    const saving = matchLineupReducer(INITIAL_MATCH_LINEUP, { type: "save-started" });
    expect(saving).toEqual({ confirmingDiscard: false, saving: true, refusal: null });
    expect(matchLineupReducer(saving, { type: "save-refused", text: "x" })).toEqual({
      confirmingDiscard: false,
      saving: false,
      refusal: "x",
    });
  });
});
