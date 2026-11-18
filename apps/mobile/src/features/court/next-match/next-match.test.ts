import { readFileSync } from "node:fs";

import {
  defaultGroupSettings,
  parseMatchStartedPayload,
  startMatch,
  type CourtSessionState,
  type FinishedMatch,
  type GroupSettings,
  type MemberId,
  type NextMatchPlan,
  type QueueSettings,
  type TeamState,
  type TeamQueue,
  type TeamSide,
} from "@sacou/match-engine";
import { describe, expect, test } from "vitest";

import type { CourtRoster } from "../ports/court-roster";
import { EMPTY_NEXT_MATCH_DRAFT, type NextMatchDraft } from "../ports/next-match-draft-store";
import { exitRows, nextWith, planExplanation, resultView } from "./match-end-selectors";
import { arrivalOrderOf } from "./next-match-input";
import { nextMatchModel, type NextMatchModel } from "./next-match-model";
import { buildNextMatchStart } from "./next-match-start";

interface GoldenCase {
  readonly id: string;
  readonly input: { readonly state: CourtSessionState };
}

/** The shared golden of the queue (TS and C#): its first case is the scenario of the review. */
const GOLDEN: readonly GoldenCase[] = JSON.parse(
  readFileSync(
    new URL("../../../../../../packages/match-engine/golden/queue-plans.json", import.meta.url),
    "utf8",
  ),
) as readonly GoldenCase[];

const REVIEW = GOLDEN.find(({ id }) => id.startsWith("q1-review"))?.input.state;
if (REVIEW === undefined) throw new Error("the review case is missing from the golden");

const b = (n: string): MemberId => `b0000000-0000-4000-8000-0000000000${n}`;
const NAMES: Readonly<Record<string, string>> = {
  [b("01")]: "Rafa",
  [b("02")]: "Duda",
  [b("03")]: "Gil",
  [b("04")]: "Hugo",
  [b("05")]: "Davi",
  [b("06")]: "Sofia",
  [b("07")]: "Bia",
  [b("08")]: "Caio",
};

const ROSTER: CourtRoster = {
  nameOf: (memberId) => NAMES[memberId] ?? "Jogador",
  teamAppearance: (_matchId, side: TeamSide) =>
    side === "a" ? { label: "Laranja", color: "orange" } : { label: "Azul", color: "blue" },
};

function settingsWith(queue: Partial<QueueSettings> = {}, rotationOn = true): GroupSettings {
  const base = defaultGroupSettings();
  return {
    ...base,
    queue: { ...base.queue, enabled: true, ...queue },
    rotation: { ...base.rotation, enabled: rotationOn, system: "5x1" },
  };
}

function lastOf(state: CourtSessionState): FinishedMatch {
  const last = state.finishedMatches.at(-1);
  if (last === undefined) throw new Error("no finished match");
  return last;
}

function withLast(
  state: CourtSessionState,
  change: (match: FinishedMatch) => FinishedMatch,
  queue: TeamQueue = state.queue,
): CourtSessionState {
  const matches = state.finishedMatches;
  return { ...state, queue, finishedMatches: [...matches.slice(0, -1), change(lastOf(state))] };
}

/** The review with Azul ending the match with its setter in `zone` (the golden has 1). */
function reviewAt(
  zone: TeamState["setterZone"],
  base: CourtSessionState = REVIEW as CourtSessionState,
) {
  return withLast(base, (match) => ({
    ...match,
    rotations: {
      ...match.rotations,
      b: match.rotations.b && { ...match.rotations.b, setterZone: zone },
    },
  }));
}

function model(
  state: CourtSessionState,
  settings = settingsWith(),
  draft: NextMatchDraft = EMPTY_NEXT_MATCH_DRAFT,
): NextMatchModel {
  return nextMatchModel({ state, settings, confirmed: [], draft, roster: ROSTER });
}

function planOf(next: NextMatchModel): NextMatchPlan {
  if (next.kind !== "planned") throw new Error(`no plan: ${next.kind}`);
  return next.plan;
}

function explain(state: CourtSessionState, settings = settingsWith()): string {
  return planExplanation({
    state,
    match: lastOf(state),
    plan: planOf(model(state, settings)),
    criterion: settings.queue.exitCriterion,
    fixedCount: settings.queue.exitMode === "fixed-count",
    roster: ROSTER,
  });
}

describe("screen 11 in the scenario of the review (fila.md)", () => {
  const state = reviewAt(6);

  test("Laranja won its third in a row with the same members", () => {
    expect(resultView(state, lastOf(state), ROSTER)).toMatchObject({
      heading: "Fim do set 1 · partida encerrada",
      winnerText: "Laranja venceu",
      lastSet: "25–21",
      sets: "sets 1–0",
      streak: "3ª seguida",
    });
  });

  test("the sentence, who leaves and who comes in, as the canvas", () => {
    const plan = planOf(model(state));
    expect(explain(state)).toBe(
      "Azul perdeu: saída parcial no Azul. Tem 2 reservas esperando: saem 2 do Azul (quem está há mais partidas seguidas).",
    );
    expect(exitRows(lastOf(state), plan, ROSTER)).toEqual({
      leaving: [
        { memberId: b("01"), name: "Rafa", detail: "3 seguidas" },
        { memberId: b("02"), name: "Duda", detail: "3 seguidas" },
      ],
      entering: [
        { memberId: b("05"), name: "Davi", detail: "posição 1" },
        { memberId: b("06"), name: "Sofia", detail: "posição 5" },
      ],
      swaps: "Davi entra no lugar de Rafa e Sofia no de Duda. Rafa e Duda vão para o fim da fila.",
    });
    expect(nextWith(plan, ROSTER)).toBe("(com Davi e Sofia)");
    expect(plan.queue.players).toEqual([b("01"), b("02")]);
  });

  test("the position is the slot of the court, never the index of the lineup (pendência 22)", () => {
    const positions = (zone: TeamState["setterZone"]) => {
      const at = reviewAt(zone);
      return exitRows(lastOf(at), planOf(model(at)), ROSTER).entering.map(({ detail }) => detail);
    };
    expect(positions(3)).toEqual(["posição 4", "posição 2"]);
    expect(positions(1)).toEqual(["posição 2", "posição 6"]);
  });
});

describe("one sentence per case of the queue", () => {
  test("the winner leaves too after 3 wins: Davi and Sofia go into Laranja", () => {
    const settings = settingsWith({ winnerExitEnabled: true, winnerExitWins: 3 });
    const state = reviewAt(6);
    const plan = planOf(model(state, settings));
    expect(plan.winnerLeaving).toEqual({ side: "a", streak: 3 });
    expect(plan.exits.every(({ side }) => side === "a")).toBe(true);
    expect(explain(state, settings)).toMatch(/^Laranja saiu após 3 vitórias: saída parcial/);
  });

  test("without a winner nobody leaves", () => {
    const state = withLast(reviewAt(6), (match) => ({
      ...match,
      winner: null,
      endReason: "manual",
    }));
    expect(explain(state)).toBe("Sem vencedor: ninguém sai.");
    expect(planOf(model(state)).exits).toEqual([]);
  });

  test("nobody waiting: the same teams", () => {
    const state = withLast(reviewAt(6), (match) => match, { players: [], teams: [] });
    expect(explain(state)).toBe("Ninguém esperando. Os mesmos times.");
  });

  test("a whole team waiting comes in, with the default lineup and the setter in zone 1", () => {
    const team = [b("05"), b("06"), b("09"), b("10"), b("11"), b("12")];
    const state = withLast(reviewAt(6), (match) => match, {
      players: [],
      teams: [{ memberIds: team }],
    });
    const settings = settingsWith();
    const plan = planOf(model(state, settings));
    expect(plan.enteringTeams).toEqual(["b"]);
    expect(explain(state, settings)).toBe(
      "Azul perdeu: entra o time de Davi, Sofia, Jogador, Jogador, Jogador e Jogador. A escalação começa pela ordem de chegada.",
    );
    const payload = buildNextMatchStart({
      plan,
      finished: lastOf(state),
      settings,
      matchId: "f0000000-0000-4000-8000-000000000009",
      firstServer: "b",
      positionOf: () => null,
    });
    expect(payload.rotations.b).toEqual({
      system: "5x1",
      lineup: team,
      setterZone: 1,
      bench: [],
      libero: null,
    });
  });

  test("fixed-count says how many leave, in one sentence", () => {
    const settings = settingsWith({ exitMode: "fixed-count", fixedExitCount: 1 });
    expect(explain(reviewAt(6), settings)).toBe(
      "Azul perdeu: sai 1 do Azul (quem está há mais partidas seguidas).",
    );
  });
});

describe("the input of the plan (D7)", () => {
  test("a member of a team who is not on the list goes to the end, and the plan goes through", () => {
    const state = reviewAt(6);
    const order = arrivalOrderOf([{ memberId: b("02"), position: 1 }], lastOf(state), state.queue);
    expect(order[0]).toBe(b("02"));
    expect(order).toContain(b("01"));
    expect(model(state).kind).toBe("planned");
  });

  test("draw: the first of the shuffled order of the loser leave", () => {
    const state = reviewAt(6);
    const loser = lastOf(state).teams.b.memberIds;
    const draft: NextMatchDraft = {
      drawOrder: { a: lastOf(state).teams.a.memberIds, b: [...loser].reverse() },
      chosen: { a: [], b: [] },
    };
    const plan = planOf(model(state, settingsWith({ exitCriterion: "draw" }), draft));
    // The exits come in the order of the team; who leaves is the first two of the shuffle.
    expect(new Set(plan.exits.map(({ outgoing }) => outgoing))).toEqual(
      new Set([...loser].reverse().slice(0, 2)),
    );
  });

  test("manual: Confirmar waits for exactly 2 of Azul, and the plan takes them", () => {
    const state = reviewAt(6);
    const settings = settingsWith({ exitCriterion: "manual" });
    const one = model(state, settings, { drawOrder: null, chosen: { a: [], b: [b("07")] } });
    expect(one).toMatchObject({ kind: "planned", canConfirm: false });
    expect(
      one.kind === "planned" && one.picks.map(({ side, required }) => [side, required]),
    ).toEqual([["b", 2]]);
    const two = model(state, settings, {
      drawOrder: null,
      chosen: { a: [], b: [b("07"), b("08")] },
    });
    expect(two).toMatchObject({ kind: "planned", canConfirm: true });
    expect(planOf(two).exits.map(({ outgoing }) => outgoing)).toEqual([b("07"), b("08")]);
  });
});

describe("buildNextMatchStart", () => {
  const state = reviewAt(6);
  const settings = settingsWith();
  const plan = planOf(model(state, settings));
  const payload = buildNextMatchStart({
    plan,
    finished: lastOf(state),
    settings,
    matchId: "f0000000-0000-4000-8000-000000000009",
    firstServer: "b",
    positionOf: () => null,
  });

  test("the engine takes it, and it keeps the scoring of the finished match", () => {
    expect(parseMatchStartedPayload(payload).ok).toBe(true);
    expect(startMatch(state, payload).ok).toBe(true);
    expect(payload.scoring).toEqual(lastOf(state).scoring);
    expect(payload.firstServer).toBe("b");
  });

  test("the team that stays keeps its lineup, bench and setter zone", () => {
    expect(payload.rotations.a).toEqual(lastOf(state).rotations.a);
    expect(payload.rotations.b?.setterZone).toBe(6);
  });

  test("a team of five that comes in plays with the rotation off", () => {
    const five = [b("05"), b("06"), b("09"), b("10"), b("11")];
    const queued = withLast(state, (match) => match, { players: [], teams: [{ memberIds: five }] });
    const fivePlan = planOf(model(queued, { ...settings, format: { modality: "indoor-6x6" } }));
    const start = buildNextMatchStart({
      plan: { ...fivePlan, teams: { ...fivePlan.teams, b: { memberIds: five } } },
      finished: lastOf(queued),
      settings,
      matchId: "f0000000-0000-4000-8000-000000000009",
      firstServer: "a",
      positionOf: () => null,
    });
    expect(start.rotations.b).toBeNull();
  });

  test("only ids and rules: no name, level nor position in the payload", () => {
    const text = JSON.stringify(payload);
    for (const name of Object.values(NAMES)) expect(text).not.toContain(name);
    expect(text).not.toMatch(/level|nota|position|primaryPosition/i);
  });
});
