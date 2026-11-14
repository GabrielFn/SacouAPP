import { HALF, PERCENT } from "../court.data";
import { placeOnHalfCourt, type CourtEnd } from "./court-geometry";
import { pickCompatible } from "./name-search";
import { collides, coveredArea, overlapArea, within } from "./rect-geometry";

import type { MarkerSpec, NameOption, Rect } from "./marker-placement.types";

export type { MarkerSpec, NameOption, Rect };

/** The name stands directly below its circle, or directly above it when there is no room below. */
export type NameSide = "below" | "above";

export interface PlacedMarker {
  readonly id: string;
  /** The center of the circle, in pixels from the top left corner of the square: the point of the formation. */
  readonly x: number;
  readonly y: number;
  readonly name: {
    readonly text: string;
    readonly side: NameSide;
    readonly box: Rect;
  };
}

export interface PlacementFrame {
  readonly end: CourtEnd;
  /** The side of the square, in pixels. */
  readonly side: number;
  /** A circle and a name stay inside this (the zone, ending at the net). */
  readonly bounds: Rect;
  /** Nothing covers this (the column of the team), or `null`. */
  readonly column: Rect | null;
  /** The air kept between a name and what is around it. */
  readonly gap: number;
}

interface Circle {
  readonly id: string;
  readonly radius: number;
  readonly x: number;
  readonly y: number;
  readonly reach: number;
}

function keepInside(center: number, half: number, low: number, high: number): number {
  return high - low < half * HALF
    ? (low + high) / HALF
    : Math.min(high - half, Math.max(low + half, center));
}

function circleBox({ x, y, reach }: Circle): Rect {
  return { left: x - reach, right: x + reach, top: y - reach, bottom: y + reach };
}

/** Moves a circle out of the column by the way that costs the least. */
function leaveColumn(circle: Circle, column: Rect | null): Circle {
  if (column === null || overlapArea(circleBox(circle), column) === 0) {
    return circle;
  }
  const edges = circleBox(circle);
  const exits = [
    { axis: "x", cost: edges.right - column.left, shift: column.left - edges.right },
    { axis: "x", cost: column.right - edges.left, shift: column.right - edges.left },
    { axis: "y", cost: edges.bottom - column.top, shift: column.top - edges.bottom },
    { axis: "y", cost: column.bottom - edges.top, shift: column.bottom - edges.top },
  ] as const;
  const best = exits.reduce((a, b) => (b.cost < a.cost ? b : a));
  return best.axis === "x"
    ? { ...circle, x: circle.x + best.shift }
    : { ...circle, y: circle.y + best.shift };
}

/**
 * The circle stands exactly at the point of the formation. Only a point that falls outside the zone (the
 * server, behind the end line) is brought in, whole, and out of the column of the team.
 */
function circleAt(spec: MarkerSpec, frame: PlacementFrame): Circle {
  const place = placeOnHalfCourt(spec.point, frame.end);
  const wanted: Circle = {
    id: spec.id,
    radius: spec.radius,
    reach: spec.reach,
    x: (place.x / PERCENT) * frame.side,
    y: (place.y / PERCENT) * frame.side,
  };
  const inside = (circle: Circle): Circle => ({
    ...circle,
    x: keepInside(circle.x, circle.reach, frame.bounds.left, frame.bounds.right),
    y: keepInside(circle.y, circle.reach, frame.bounds.top, frame.bounds.bottom),
  });
  return inside(leaveColumn(inside(wanted), frame.column));
}
/** Two circles closer than this sit almost on one another: a name may touch the other one. */
function nearlyOnTop(a: Circle, b: Circle, gap: number): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) < a.reach + b.reach + gap;
}

/** How the name sits across its circle: centered, or reaching out to one side from its edge. */
type Alignment = "center" | "start" | "end";

const SIDES: readonly NameSide[] = ["below", "above"];
const ALIGNMENTS: readonly Alignment[] = ["center", "start", "end"];

interface Slot {
  readonly side: NameSide;
  readonly alignment: Alignment;
}

const SLOTS: readonly Slot[] = SIDES.flatMap((side) =>
  ALIGNMENTS.map((alignment) => ({ side, alignment })),
);

interface Row {
  readonly circle: Circle;
  readonly spec: MarkerSpec;
}

function nameRows(circle: Circle, side: NameSide, height: number, gap: number) {
  return side === "below"
    ? { top: circle.y + circle.reach + gap, bottom: circle.y + circle.reach + gap + height }
    : { top: circle.y - circle.reach - gap - height, bottom: circle.y - circle.reach - gap };
}

function startOf(circle: Circle, width: number, alignment: Alignment): number {
  if (alignment === "start") return circle.x - circle.radius;
  if (alignment === "end") return circle.x + circle.radius - width;
  return circle.x - width / HALF;
}

/** The name in a slot, pushed back inside the zone at most. */
function nameBox(row: Row, width: number, slot: Slot, frame: PlacementFrame): Rect {
  const { left: low, right: high } = frame.bounds;
  const start = Math.min(high - width, Math.max(low, startOf(row.circle, width, slot.alignment)));
  return {
    left: start,
    right: start + width,
    ...nameRows(row.circle, slot.side, row.spec.nameHeight, frame.gap),
  };
}

/** What a name must not touch: the circles around it (not one almost on its own) and the names placed. */
function obstaclesOf(row: Row, rows: readonly Row[], frame: PlacementFrame): readonly Rect[] {
  return rows
    .filter(({ circle }) => circle.id !== row.circle.id)
    .filter(({ circle }) => !nearlyOnTop(circle, row.circle, frame.gap))
    .map(({ circle }) => circleBox(circle));
}

/** A name may stand there: inside the zone, out of the column and across its own circle. */
function fitsZone(box: Rect, row: Row, frame: PlacementFrame): boolean {
  return (
    within(box, frame.bounds) &&
    box.left <= row.circle.x &&
    box.right >= row.circle.x &&
    (frame.column === null || overlapArea(box, frame.column) === 0)
  );
}

const NO_NAME: NameOption = { text: "", width: 0 };

function optionsOf(row: Row): readonly NameOption[] {
  return row.spec.names.length > 0 ? row.spec.names : [NO_NAME];
}

/** When nothing is free: the shortest name, centered below its circle, or above it at the bottom. */
function lastResort(row: Row, frame: PlacementFrame): PlacedMarker["name"] {
  const option = optionsOf(row).at(-1) ?? NO_NAME;
  const below = nameBox(row, option.width, SLOTS[0] as Slot, frame);
  const side: NameSide = below.bottom <= frame.bounds.bottom ? "below" : "above";
  const slot: Slot = { side, alignment: "center" };
  return { text: option.text, side, box: nameBox(row, option.width, slot, frame) };
}

type PlacedName = PlacedMarker["name"];

/**
 * Every free way to write and put the name among the circles alone, best first: the longest text,
 * below its circle before above it (a name flips to the other side before it is shortened),
 * centered before reaching out from an edge of its circle.
 */
function candidatesOf(
  row: Row,
  rows: readonly Row[],
  frame: PlacementFrame,
): readonly PlacedName[] {
  const obstacles = obstaclesOf(row, rows, frame);
  const named = (option: NameOption) =>
    SLOTS.map((slot) => ({
      text: option.text,
      side: slot.side,
      box: nameBox(row, option.width, slot, frame),
    })).filter(({ box }) => fitsZone(box, row, frame));
  const free = optionsOf(row).flatMap((option) =>
    named(option).filter(({ box }) => coveredArea(box, obstacles, frame.gap) === 0),
  );
  // Squeezed between circles, when no other way is left: the shortest name, over as little of
  // them as it can (a name over a circle reads better than two names over each other).
  const area = (name: PlacedName) => coveredArea(name.box, obstacles, frame.gap);
  const squeezed = named(optionsOf(row).at(-1) ?? NO_NAME)
    .filter((name) => area(name) > 0)
    .sort((a, b) => area(a) - area(b));
  return [...free, ...squeezed];
}

function clearOf(name: PlacedName, placed: readonly PlacedName[], gap: number): boolean {
  return placed.every((other) => !collides(name.box, other.box, gap));
}

interface Choice {
  readonly row: Row;
  readonly candidates: readonly PlacedName[];
}

/** Without a full solution: each marker in turn takes its first candidate still free. */
function greedy(choices: readonly Choice[], frame: PlacementFrame): readonly PlacedName[] {
  return choices.reduce<readonly PlacedName[]>(
    (placed, { row, candidates }) => [
      ...placed,
      candidates.find((name) => clearOf(name, placed, frame.gap)) ?? lastResort(row, frame),
    ],
    [],
  );
}

function byId(a: { readonly id: string }, b: { readonly id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** The whole name with the fewest free ways first, then the one with the fewest ways at all. */
function byRoom(a: Choice, b: Choice): number {
  const whole = (choice: Choice) =>
    choice.candidates.filter(({ text }) => text === optionsOf(choice.row)[0]?.text).length;
  return (
    whole(a) - whole(b) ||
    a.candidates.length - b.candidates.length ||
    a.row.circle.y - b.row.circle.y ||
    a.row.circle.x - b.row.circle.x ||
    byId(a.row.spec, b.row.spec)
  );
}

/**
 * Where each marker goes: the circle is exactly on its point (only a point outside the zone is
 * brought in; two circles on nearly the same point overlap, as on the court) and the name is
 * attached to it, directly below or directly above, across its circle. Each name takes the longest
 * text that touches no other circle and no other name; the names with the least room choose first.
 * No random number: same lineup, same screen.
 */
export function placeMarkers(
  frame: PlacementFrame,
  markers: readonly MarkerSpec[],
): readonly PlacedMarker[] {
  const rows = [...markers]
    .sort(byId)
    .map<Row>((spec) => ({ circle: circleAt(spec, frame), spec }));
  const choices = rows
    .map<Choice>((row) => ({ row, candidates: candidatesOf(row, rows, frame) }))
    .sort(byRoom);
  const found =
    pickCompatible(
      choices.map(({ candidates }) => candidates),
      (a, b) => collides(a.box, b.box, frame.gap),
    ) ?? greedy(choices, frame);
  const names = new Map(choices.map(({ row }, index) => [row.spec.id, found[index]]));
  return rows.map((row) => ({
    id: row.spec.id,
    x: row.circle.x,
    y: row.circle.y,
    name: names.get(row.spec.id) ?? lastResort(row, frame),
  }));
}
