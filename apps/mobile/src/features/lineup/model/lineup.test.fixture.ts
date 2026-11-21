import type { MemberId, TeamSide, TeamState } from "@sacou/match-engine";
import type { FormationSystem, SetterZone } from "@sacou/volley-rules";

import type { PositionOf, PrimaryPosition } from "../../draw/model/default-lineup";
import type { LineupBase } from "./lineup-editor.reducer";
import type { LineupSource, LineupTeamSource } from "./lineup-source";

/** "pedro" is called "Pedro": the test reads the names the canvas shows. */
export function nameOf(memberId: MemberId): string {
  return `${memberId.charAt(0).toUpperCase()}${memberId.slice(1)}`;
}

export function positionsOf(positions: Readonly<Record<string, string | undefined>>): PositionOf {
  return (memberId) => (positions[memberId] ?? null) as PrimaryPosition;
}

export const CANVAS_POSITIONS: Readonly<Record<string, string | undefined>> = {
  pedro: "setter",
  ana: "middleBlocker",
  lia: "outsideHitter",
  marcos: "opposite",
  bia: "outsideHitter",
  joao: "middleBlocker",
};

export function teamState(
  lineup: readonly MemberId[],
  setterZone: SetterZone,
  system: FormationSystem = "5x1",
): TeamState {
  return Object.freeze({
    system,
    lineup: Object.freeze([...lineup]),
    setterZone,
    bench: [],
    libero: null,
  });
}

/** The team of the canvas: 5x1, Pedro sets from zone 2 (Escalacao.dc.html). */
const CANVAS_SETTER_ZONE = 2;
const FULL_TEAM = 6;
const SHORT_TEAM = 5;

export const CANVAS_TEAM = teamState(
  ["pedro", "ana", "lia", "marcos", "bia", "joao"],
  CANVAS_SETTER_ZONE,
);

export function baseOf(state: TeamState, side: TeamSide = "a", key = "k1"): LineupBase {
  return { side, state, key, liberoExit: "out" };
}

export function teamSource(
  side: TeamSide,
  base: LineupBase | null,
  overrides: Partial<LineupTeamSource> = {},
): LineupTeamSource {
  return {
    side,
    name: side === "a" ? "Laranja" : "Azul",
    color: side === "a" ? "orange" : "blue",
    size: base === null ? SHORT_TEAM : FULL_TEAM,
    base,
    phase: side === "a" ? "serving" : "receiving",
    liberoPool: ["sofia", "rafa"],
    benchPool: ["sofia", "rafa"],
    noLiberoText: "Sem reservas para líbero.",
    ...overrides,
  };
}

export function sourceOf(
  a: LineupTeamSource,
  b: LineupTeamSource,
  positions = CANVAS_POSITIONS,
): LineupSource {
  return {
    subtitle: "Partida 1 · antes de começar",
    teams: { a, b },
    nameOf,
    positionOf: positionsOf(positions),
  };
}
