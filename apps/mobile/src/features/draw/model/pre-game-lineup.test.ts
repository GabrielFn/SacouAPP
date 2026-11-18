import {
  getTeamServeAlignment,
  INITIAL_COURT_SESSION_STATE,
  MIDDLE_BLOCKER_LINEUP_INDEXES,
  parseMatchStartedPayload,
  startMatch,
  type TeamSide,
  type TeamState,
} from "@sacou/match-engine";
import { ROTATION_SLOTS } from "@sacou/volley-rules";
import { describe, expect, test } from "vitest";

import { createFakeCourtEventLog } from "../../../adapters/fake-court-event-log";
import { createSequentialIdGenerator } from "../../../adapters/fake-sequential-id-generator";
import { createCourtReplayer } from "../../court/session/court-replay";
import { sessionState } from "../../court/session/round-court";
import { startFromDraw } from "../session/start-from-draw";
import { initialLineupEditorState } from "../../lineup/model/lineup-editor.reducer";
import { lineupView } from "../../lineup/model/lineup-selectors";
import { PENDING_PRE_GAME_SCREENS } from "../navigation";
import { drawFlowReducer, type DrawFlowAction, type DrawFlowState } from "./draw-flow.reducer";
import { drawnG1, G1_ORDER, RESERVES, TEAM_A, TEAM_B } from "./draw.test.fixture";
import { buildMatchStart, teamRotation } from "./match-start";
import type { PreGameChoices, SavedLineup } from "./pre-game";
import { toSavedLineup } from "./pre-game-lineup";
import { preGameLineupSource } from "./pre-game-lineup-source";
import { rotationView } from "./pre-game-selectors";
import { g1Input, g1UuidArrangement, g1UuidNames, uuidOf } from "./pre-game.test.fixture";

const nameOf = g1UuidNames();
const ORIGIN = { groupId: "g1", roundId: "r1" };

function runtime() {
  const ids = createSequentialIdGenerator();
  return { log: createFakeCourtEventLog(ids), replayer: createCourtReplayer(), ids };
}
const MATCH_ID = "b0000000-0000-4000-8000-000000000001";
const SOFIA = uuidOf("sofia");

function defaultOf(side: TeamSide, preGame: Partial<PreGameChoices> = {}): TeamState {
  const rotation = teamRotation(g1Input(preGame), side);
  if (rotation === null) throw new Error("no rotation");
  return rotation;
}

function saved(state: TeamState, patch: Partial<SavedLineup> = {}): SavedLineup {
  return { ...toSavedLineup(state), ...patch };
}

function started(preGame: Partial<PreGameChoices>, arrangement = g1UuidArrangement()) {
  const payload = buildMatchStart(g1Input(preGame, undefined, arrangement), MATCH_ID);
  if (!payload.ok) throw new Error("not built");
  return payload.value;
}

const POSITION_WORDS = ["setter", "outsidehitter", "middleblocker", "opposite", "libero", "any"];
const FIXTURE_NAMES = G1_ORDER.map((key) => nameOf(uuidOf(key)).toLowerCase());

/** The texts of a value, with no keys: a position as a value is a profile that leaked. */
function values(value: unknown): readonly string[] {
  return leaves(value).filter((word) => !Object.keys(flatKeys(value)).includes(word));
}

function flatKeys(value: unknown): Record<string, true> {
  if (Array.isArray(value)) return Object.assign({}, ...value.map(flatKeys));
  if (value instanceof Map) return flatKeys([...value.entries()]);
  if (value === null || typeof value !== "object") return {};
  return Object.assign(
    {},
    ...Object.entries(value).map(([key, inner]) => ({ [key]: true as const, ...flatKeys(inner) })),
  );
}

/** Every key and text of a value, to find a level anywhere. */
function leaves(value: unknown): readonly string[] {
  if (Array.isArray(value)) return value.flatMap(leaves);
  if (value instanceof Map) return leaves([...value.entries()]);
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, inner]) => [key, ...leaves(inner)]);
  }
  return [String(value)];
}

describe("the libero of the start, a reserve chosen on screen 22 (D5, question 76)", () => {
  const withSofia = (side: TeamSide = "a") => ({
    lineups: { [side]: saved(defaultOf(side), { libero: SOFIA }) },
  });

  test("Sofia leaves the queue and joins Laranja as the libero of the middle blockers", () => {
    const payload = started(withSofia());
    expect(payload.teams.a.memberIds).toEqual([...TEAM_A.map(uuidOf), SOFIA]);
    expect(payload.rotations.a?.libero).toEqual({
      memberId: SOFIA,
      replacedIndexes: MIDDLE_BLOCKER_LINEUP_INDEXES,
    });
    expect(payload.queue.players).toEqual([uuidOf("davi")]);
    expect(parseMatchStartedPayload(payload).ok).toBe(true);
    expect(startMatch(INITIAL_COURT_SESSION_STATE, payload).ok).toBe(true);
  });

  // rotacoes.md: the slot of the libero by setter zone; `null` where it is out (front row or serving).
  const SLOT_BY_ZONE: Readonly<Record<"receiving" | "serving", readonly (number | null)[]>> = {
    receiving: [6, 1, 5, 6, 1, 5],
    serving: [6, null, 5, 6, null, 5],
  };

  test.each(
    ROTATION_SLOTS.flatMap((zone) =>
      (["receiving", "serving"] as const).map((phase) => [zone, phase] as const),
    ),
  )("zone %i, %s: the replay puts Sofia where the table says", async (zone, phase) => {
    const lineups = { a: saved(defaultOf("a"), { libero: SOFIA, setterZone: zone }) };
    const court = runtime();
    const input = g1Input({ lineups, firstServer: phase === "serving" ? "a" : "b" });
    const id = await startFromDraw(court, ORIGIN, input);
    const state = await sessionState(court, id.ok ? id.value : "");
    const alignment = getTeamServeAlignment(state.ok ? state.value.currentMatch : null, "a");
    const slot = ROTATION_SLOTS.find((at) => alignment?.slots[at].memberId === SOFIA) ?? null;
    expect(slot).toBe(SLOT_BY_ZONE[phase][ROTATION_SLOTS.indexOf(zone)]);
  });

  test("4x2 on the 08: the libero goes, Sofia back in the queue, with no action", () => {
    const payload = started({ ...withSofia(), systems: { a: "4x2", b: null } });
    expect(payload.rotations.a?.libero).toBeNull();
    expect(payload.teams.a.memberIds).toHaveLength(TEAM_A.length);
    expect(payload.queue.players).toEqual(RESERVES.map(uuidOf));
  });

  test("Sofia swapped into the team on the 07: the saved lineup and libero go, the default comes back", () => {
    const swapped = g1UuidArrangement([["sofia", ...TEAM_A.slice(1)], TEAM_B], ["davi", TEAM_A[0]]);
    const payload = started(withSofia(), swapped);
    expect(payload.rotations.a?.libero).toBeNull();
    expect(payload.rotations.a?.setterZone).toBe(1);
  });

  test("the same reserve for both teams: only Laranja keeps it", () => {
    const lineups = { ...withSofia("a").lineups, ...withSofia("b").lineups };
    const payload = started({ lineups });
    expect(payload.rotations.a?.libero?.memberId).toBe(SOFIA);
    expect(payload.rotations.b?.libero).toBeNull();
    expect(payload.teams.b.memberIds).toHaveLength(TEAM_B.length);
  });

  test("the 08 says the libero", () => {
    const view = rotationView(g1Input(withSofia()), nameOf);
    expect(view?.benchLine).toBe("Laranja tem 6 e líbero Sofia.");
  });

  test("no level, name or position in the MatchStarted with a libero (events carry only IDs)", () => {
    const payload = started(withSofia());
    const words = leaves(payload).map((word) => word.toLowerCase());
    expect(words.filter((word) => word.includes("level"))).toEqual([]);
    expect(words.filter((word) => FIXTURE_NAMES.some((name) => word.includes(name)))).toEqual([]);
    const texts = values(payload).map((word) => word.toLowerCase());
    expect(texts.filter((word) => POSITION_WORDS.includes(word))).toEqual([]);
  });
});

describe("a saved lineup on the 08 (D3)", () => {
  test("a new zone holds and the 08 reads it", () => {
    const base = defaultOf("a");
    const lineups = { a: saved(base, { setterZone: 4 }) };
    expect(teamRotation(g1Input({ lineups }), "a")?.setterZone).toBe(4);
    expect(rotationView(g1Input({ lineups }), nameOf)?.picker?.setterLine).toMatch(
      /começa na posição 4$/u,
    );
  });

  test("another system on the 08: the saved lineup no longer holds", () => {
    const lineups = { a: saved(defaultOf("a"), { setterZone: 4 }) };
    expect(
      teamRotation(g1Input({ lineups, systems: { a: "6x2", b: null } }), "a")?.setterZone,
    ).toBe(1);
  });
});

describe("the flow: 08 → 22 → 08 (D1)", () => {
  function run(state: DrawFlowState, ...actions: readonly DrawFlowAction[]): DrawFlowState {
    return actions.reduce(drawFlowReducer, state);
  }
  const opened = run(drawnG1(), { type: "pre-game-opened" }, { type: "lineup-opened" });

  test("Escalação opens only over the 08; Fechar goes back with nothing changed", () => {
    expect(run(drawnG1(), { type: "lineup-opened" }).sheet).toBe("none");
    expect(opened.sheet).toBe("lineup");
    const closed = run(opened, { type: "lineup-closed" });
    expect(closed.sheet).toBe("pre-game");
    expect(closed.preGame.lineups).toEqual({});
  });

  test("Salvar keeps the changed teams and goes back to the 08", () => {
    const lineup = saved(defaultOf("a"), { setterZone: 3 });
    const after = run(opened, { type: "lineup-saved", lineups: { a: lineup } });
    expect(after.sheet).toBe("pre-game");
    expect(after.preGame.lineups).toEqual({ a: lineup });
  });

  test("nothing of screen 22 carries a level", () => {
    const input = g1Input();
    const source = preGameLineupSource(input, nameOf, 1);
    const view = lineupView(initialLineupEditorState("a"), source);
    expect(source.teams.a.base).not.toBeNull();
    const words = leaves(view).map((word) => word.toLowerCase());
    expect(words.filter((word) => word.includes("level"))).toEqual([]);
    const texts = values(view).map((word) => word.toLowerCase());
    expect(texts.filter((word) => POSITION_WORDS.includes(word))).toEqual([]);
    expect(view.subtitle).toBe("Partida 1 · antes de começar");
    expect(view.team?.phaseLabel).toBe("Laranja sacando");
  });

  test("no screen of the 08 waits any more", () => {
    expect(PENDING_PRE_GAME_SCREENS).toEqual([]);
  });
});
