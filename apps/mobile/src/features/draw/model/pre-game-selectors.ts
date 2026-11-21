import {
  BEST_OF_VALUES,
  getServingPlayer,
  SETTER_LINEUP_INDEXES,
  type BestOf,
  type TeamSide,
  type TeamState,
} from "@sacou/match-engine";
import type { FormationSystem } from "@sacou/volley-rules";

import { drawStrings } from "../../../strings/draw.pt-BR";
import type { RoundCourt } from "../../court/session/round-court";
import type { DrawNameOf } from "./draw-names";
import type { OtherCourtView } from "./other-court-view";
import { rotates, systemOf, teamOfSide, teamRotation, type MatchStartInput } from "./match-start";
import { chosenOr, POINTS_PER_SET_RANGE } from "./pre-game";
import { teamIdentity, type TeamIdentity } from "./team-identity";

const { preGame: texts } = drawStrings;

const SIDES: readonly TeamSide[] = ["a", "b"];
const SIDE_INDEX: Readonly<Record<TeamSide, number>> = { a: 0, b: 1 };

/** The order of the picker on screen 08, with one "Livre" button and no "6x0" (D9). */
export const PICKER_SYSTEMS: readonly FormationSystem[] = ["livre", "4x2", "5x1", "6x2"];

const BEST_OF_LABELS: Readonly<Record<BestOf, string>> = {
  1: texts.bestOf.one,
  3: texts.bestOf.three,
  5: texts.bestOf.five,
};

type Choices = Pick<MatchStartInput, "preGame" | "settings">;

export function sideIdentity(side: TeamSide): TeamIdentity {
  return teamIdentity(SIDE_INDEX[side]);
}

export interface PointsView {
  readonly value: number;
  readonly canLess: boolean;
  readonly canMore: boolean;
}

export function pointsView({ preGame, settings }: Choices): PointsView {
  const value = chosenOr(preGame.pointsPerSet, settings.scoring.pointsPerSet);
  return {
    value,
    canLess: value > POINTS_PER_SET_RANGE.min,
    canMore: value < POINTS_PER_SET_RANGE.max,
  };
}

export interface Option<T> {
  readonly value: T;
  readonly label: string;
}

export interface SetsView {
  readonly selected: BestOf;
  readonly options: readonly Option<BestOf>[];
}

export function setsView({ preGame, settings }: Choices): SetsView {
  return {
    selected: chosenOr(preGame.bestOf, settings.scoring.bestOf),
    options: BEST_OF_VALUES.map((value) => ({ value, label: BEST_OF_LABELS[value] })),
  };
}

/** "Tie-break: 15 pontos", only for more than one set with the tie-break on. */
export function tieBreakLine(choices: Choices): string | null {
  const { scoring } = choices.settings;
  const bestOf = setsView(choices).selected;
  return bestOf > 1 && scoring.tieBreakEnabled ? texts.tieBreak(scoring.tieBreakPoints) : null;
}

/** Who stands in zone 1 at the start, by the engine; `null` without rotation. */
function starterOf(rotation: TeamState | null): string | null {
  return rotation === null ? null : getServingPlayer(rotation.lineup, rotation.setterZone);
}

/** "A · João" (who serves first, by the engine) or "A · Laranja" for a team without rotation (D6). */
export function firstServerOptions(
  input: MatchStartInput,
  nameOf: DrawNameOf,
): readonly Option<TeamSide>[] {
  return SIDES.map((side) => {
    const team = sideIdentity(side);
    const starter = starterOf(teamRotation(input, side));
    return {
      value: side,
      label: texts.serverOption(team.letter, starter === null ? team.name : nameOf(starter)),
    };
  });
}

function setterLine(rotation: TeamState, teamName: string, nameOf: DrawNameOf): string {
  const [first, second] = SETTER_LINEUP_INDEXES[rotation.system].map((index) =>
    nameOf(rotation.lineup[index] ?? ""),
  );
  const starter = nameOf(getServingPlayer(rotation.lineup, rotation.setterZone));
  if (first === undefined) return texts.noSetter(starter, rotation.setterZone);
  return second === undefined
    ? texts.oneSetter(teamName, first, rotation.setterZone)
    : texts.twoSetters(first, second);
}

export interface RotationTab {
  readonly side: TeamSide;
  readonly label: string;
  readonly team: TeamIdentity;
}

export interface RotationView {
  readonly tabs: readonly RotationTab[];
  readonly side: TeamSide;
  readonly team: TeamIdentity;
  /** `null` for a team without six: it plays with the rotation off. */
  readonly picker: {
    readonly system: FormationSystem;
    readonly options: readonly Option<FormationSystem>[];
    readonly setterLine: string;
  } | null;
  /** "Laranja tem 6, sem banco." or "Laranja tem 5: sem rotação." */
  readonly benchLine: string;
}

function tabLabel(input: MatchStartInput, side: TeamSide, team: TeamIdentity): string {
  const rotating = rotates(input.settings, teamOfSide(input.arrangement, side));
  const system = systemOf(input.preGame, input.settings, side);
  return rotating ? texts.rotationTab(team.name, texts.systems[system]) : team.name;
}

/** "Laranja tem 6, sem banco.", "Laranja tem 6 e líbero Sofia.", "... e banco Davi." or "Laranja tem 5: sem rotação." */
function benchLine(
  rotation: TeamState | null,
  teamName: string,
  size: number,
  nameOf: DrawNameOf,
): string {
  if (rotation === null) return texts.noRotation(teamName, size);
  const libero = rotation.libero === null ? null : nameOf(rotation.libero.memberId);
  const bench = rotation.bench.map(nameOf).join(texts.benchSeparator);
  if (rotation.bench.length === 0)
    return libero === null
      ? texts.fullTeam(teamName, size)
      : texts.withLibero(teamName, size, libero);
  return libero === null
    ? texts.withBench(teamName, size, bench)
    : texts.withLiberoAndBench(teamName, size, libero, bench);
}

/** The section "Rotação de cada time": `null` when the round has the rotation off (D6). */
export function rotationView(input: MatchStartInput, nameOf: DrawNameOf): RotationView | null {
  if (!input.settings.rotation.enabled) return null;
  const side = input.preGame.rotationTab;
  const team = sideIdentity(side);
  const size = teamOfSide(input.arrangement, side).length;
  const rotation = teamRotation(input, side);
  return {
    tabs: SIDES.map((tab) => {
      const identity = sideIdentity(tab);
      return { side: tab, team: identity, label: tabLabel(input, tab, identity) };
    }),
    side,
    team,
    picker:
      rotation === null
        ? null
        : {
            system: rotation.system,
            options: PICKER_SYSTEMS.map((value) => ({ value, label: texts.systems[value] })),
            setterLine: setterLine(rotation, team.name, nameOf),
          },
    benchLine: benchLine(rotation, team.name, size, nameOf),
  };
}

/** "Partida N": the matches already begun in the session of this round, plus one (D6). */
export function matchNumber(court: RoundCourt | null): number {
  return (court?.startedMatches ?? 0) + 1;
}

export type StartBlocker =
  | "stale"
  | "open-match"
  /** A match is on in another round on this phone (R97, D2): the 08 links to it. */
  | "other-round-open"
  /** A match of another account is left in a round that ended (R97, D5): only that account ends it. */
  | "other-round-other-account";

const NO_OTHER_COURT: OtherCourtView = { kind: "none" };

/**
 * Why "Começar partida" is off: someone left the list, the session has a match on (D6), or another
 * round holds the court of this phone (R97, D2). A forgotten match of this account is not a blocker:
 * the start asks to end it first (D5).
 */
export function startBlocker(
  leftSinceDraw: number,
  court: RoundCourt | null,
  other: OtherCourtView = NO_OTHER_COURT,
): StartBlocker | null {
  if (leftSinceDraw > 0) return "stale";
  if (court?.openMatch === true) return "open-match";
  if (other.kind === "open") return "other-round-open";
  return other.kind === "other-account" ? "other-round-other-account" : null;
}

export function canStart(
  leftSinceDraw: number,
  court: RoundCourt | null,
  other: OtherCourtView = NO_OTHER_COURT,
): boolean {
  return startBlocker(leftSinceDraw, court, other) === null;
}
