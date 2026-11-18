import type { MemberId } from "@sacou/match-engine";
import { drawBalance } from "@sacou/volley-rules";

import { drawStrings } from "../../../strings/draw.pt-BR";
import { formatLevel } from "../../../ui/skill-level";
import type { DrawArrangement } from "./draw-arrangement";
import { teamIdentity, type TeamIdentity } from "./team-identity";

/** Question 55: up to 2 tenths apart is "ótimo", up to 5 "bom", more is "desequilibrado". */
export const GREAT_MAX_DIFFERENCE_TENTHS = 2;
export const GOOD_MAX_DIFFERENCE_TENTHS = 5;

const TENTHS_PER_POINT = 10;
const PERCENT = 100;
/** With two teams both get a marker; with more, only the highest and the lowest. */
const MARKED_TEAMS = 2;

export type MeterLabel = "great" | "good" | "unbalanced";

export function meterLabel(differenceTenths: number): MeterLabel {
  if (differenceTenths <= GREAT_MAX_DIFFERENCE_TENTHS) return "great";
  return differenceTenths <= GOOD_MAX_DIFFERENCE_TENTHS ? "good" : "unbalanced";
}

/** The bar shows one whole point holding both averages, or as many as the gap needs (D5). */
export interface MeterAxis {
  readonly fromTenths: number;
  readonly toTenths: number;
}

export function meterAxis(lowestTenths: number, highestTenths: number): MeterAxis {
  const fromTenths = Math.floor(lowestTenths / TENTHS_PER_POINT) * TENTHS_PER_POINT;
  const onePoint = fromTenths + TENTHS_PER_POINT;
  const toTenths =
    highestTenths <= onePoint
      ? onePoint
      : Math.ceil(highestTenths / TENTHS_PER_POINT) * TENTHS_PER_POINT;
  return { fromTenths, toTenths };
}

export interface MeterMarker {
  readonly team: TeamIdentity;
  /** From 0 (start of the axis) to 100 (its end). */
  readonly percent: number;
}

export interface MeterView {
  readonly title: string;
  readonly label: MeterLabel;
  readonly axisStart: string;
  readonly axisEnd: string;
  readonly averages: string;
  /** The highest and the lowest team; with two teams, both. */
  readonly markers: readonly MeterMarker[];
  /** The green band between the lowest and the highest average, in percent of the axis. */
  readonly band: { readonly start: number; readonly end: number };
  readonly accessibilityLabel: string;
}

function percentOn(axis: MeterAxis, tenths: number): number {
  return ((tenths - axis.fromTenths) * PERCENT) / (axis.toTenths - axis.fromTenths);
}

function levelsOf(arrangement: DrawArrangement, team: readonly MemberId[]): readonly number[] {
  return team.flatMap((memberId) => {
    const tenths = arrangement.levels.get(memberId);
    return tenths === undefined ? [] : [tenths];
  });
}

/**
 * The meter of screen 07, recalculated in TS from the arrangement (golden `draw-balance.json`), so a
 * "Trocar" moves it without a network. `null` when a team has no level: "Montar times" (question 72)
 * has none, and a draw always has them all.
 */
export function meterView(arrangement: DrawArrangement): MeterView | null {
  const levels = arrangement.teams.map((team) => levelsOf(arrangement, team));
  const complete = levels.every((team, index) => team.length === arrangement.teams[index]?.length);
  const balance = drawBalance(levels);
  if (!complete || !balance.ok) return null;
  const { averagesTenths, differenceTenths } = balance.value;
  const teams = averagesTenths.map((tenths, index) => ({ tenths, team: teamIdentity(index) }));
  const lowest = Math.min(...averagesTenths);
  const highest = Math.max(...averagesTenths);
  const axis = meterAxis(lowest, highest);
  const shown = teams.length <= MARKED_TEAMS ? teams : extremes(teams, lowest, highest);
  const label = meterLabel(differenceTenths);
  const { meter } = drawStrings;
  return {
    title: meter.difference(formatLevel(differenceTenths), meter.labels[label]),
    label,
    axisStart: formatLevel(axis.fromTenths),
    axisEnd: formatLevel(axis.toTenths),
    averages: meter.averages(
      shown.map(({ team, tenths }) => meter.average(team.letter, formatLevel(tenths))),
    ),
    markers: shown.map(({ team, tenths }) => ({ team, percent: percentOn(axis, tenths) })),
    band: { start: percentOn(axis, lowest), end: percentOn(axis, highest) },
    accessibilityLabel: meter.accessibility(
      teams.map(({ team, tenths }) => meter.accessibilityPart(team.name, formatLevel(tenths))),
    ),
  };
}

interface TeamAverage {
  readonly tenths: number;
  readonly team: TeamIdentity;
}

function extremes(
  teams: readonly TeamAverage[],
  lowest: number,
  highest: number,
): readonly TeamAverage[] {
  const top = teams.find(({ tenths }) => tenths === highest);
  const bottom = teams.find(({ tenths }) => tenths === lowest && tenths !== top?.tenths);
  return [top, bottom].filter((team): team is TeamAverage => team !== undefined);
}
