import { HALF, PERCENT } from "../court.data";
import { placeOnHalfCourt, type CourtEnd } from "./court-geometry";

import type { MarkerSpec, NameOption, Rect } from "./marker-placement.types";

export type { MarkerSpec, NameOption, Rect };

/** Where the name stands around its circle, in the order the sides are tried. */
export type NameSide =
  "below" | "above" | "right" | "left" | "belowRight" | "belowLeft" | "aboveRight" | "aboveLeft";

const NAME_SIDES: readonly NameSide[] = [
  "below",
  "above",
  "right",
  "left",
  "belowRight",
  "belowLeft",
  "aboveRight",
  "aboveLeft",
];

/**
 * The name hugs its circle: the air between them is the gap and at most half a diameter (the radius),
 * tried in these fractions of that slack, the closest first.
 */
const NAME_SLACK_STEPS = [0, 1 / HALF, 1] as const;

/** A name that is not nearer to its own circle than to any other costs this much, as if it covered it. */
const NOT_NEAREST_PENALTY = 4000;

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

/** Covering a circle costs more than covering a name or an edge: the name gives way first. */
const CIRCLE_WEIGHT = 10;

/** A name always stays in view: sticking out of the zone costs more than reading as another's. */
const OUTSIDE_WEIGHT = 100;

interface Circle {
  readonly id: string;
  readonly radius: number;
  readonly x: number;
  readonly y: number;
  readonly reach: number;
}

interface Size {
  readonly width: number;
  readonly height: number;
}

interface Candidate {
  readonly text: string;
  readonly side: NameSide;
  readonly box: Rect;
  readonly covered: number;
  /** The center of the name is nearer to its own circle than to any other. */
  readonly nearest: boolean;
}

function keepInside(center: number, half: number, low: number, high: number): number {
  return high - low < half * HALF
    ? (low + high) / HALF
    : Math.min(high - half, Math.max(low + half, center));
}

function overlapArea(a: Rect, b: Rect): number {
  const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return width > 0 && height > 0 ? width * height : 0;
}

function areaOf(box: Rect): number {
  return (box.right - box.left) * (box.bottom - box.top);
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
 * The circle stands at the point of the formation. Only a point that falls outside the zone (the
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

/** The box of a name of this size at one side of a circle, `gap` away from it. */
function nameBox(circle: Circle, side: NameSide, { width, height }: Size, distance: number): Rect {
  const near = circle.reach + distance;
  const diagonal = near / HALF;
  const middleX = circle.x - width / HALF;
  const middleY = circle.y - height / HALF;
  const lefts = {
    below: middleX,
    above: middleX,
    right: circle.x + near,
    left: circle.x - near - width,
    belowRight: circle.x + diagonal,
    belowLeft: circle.x - diagonal - width,
    aboveRight: circle.x + diagonal,
    aboveLeft: circle.x - diagonal - width,
  };
  const tops = {
    below: circle.y + near,
    above: circle.y - near - height,
    right: middleY,
    left: middleY,
    belowRight: circle.y + near,
    belowLeft: circle.y + near,
    aboveRight: circle.y - near - height,
    aboveLeft: circle.y - near - height,
  };
  return {
    left: lefts[side],
    right: lefts[side] + width,
    top: tops[side],
    bottom: tops[side] + height,
  };
}

/** The area of a box that sticks out of the bounds. */
function outsideArea(box: Rect, bounds: Rect): number {
  return areaOf(box) - overlapArea(box, bounds);
}

/** How much a name box covers: the circles (with their badges), the names placed, the column and the outside. */
function coverageOf(
  box: Rect,
  circles: readonly Circle[],
  names: readonly Rect[],
  frame: PlacementFrame,
): number {
  const air = frame.gap / HALF;
  const padded: Rect = {
    left: box.left - air,
    right: box.right + air,
    top: box.top - air,
    bottom: box.bottom + air,
  };
  const onCircles = circles.reduce((sum, c) => sum + overlapArea(padded, circleBox(c)), 0);
  const onNames = names.reduce((sum, other) => sum + overlapArea(padded, other), 0);
  const onColumn = frame.column === null ? 0 : overlapArea(padded, frame.column);
  const outside = outsideArea(box, frame.bounds);
  return onCircles * CIRCLE_WEIGHT + outside * OUTSIDE_WEIGHT + onNames + onColumn;
}

function isNearest(box: Rect, circle: Circle, others: readonly Circle[]): boolean {
  const centerX = (box.left + box.right) / HALF;
  const centerY = (box.top + box.bottom) / HALF;
  const distanceTo = (c: Circle) => Math.hypot(c.x - centerX, c.y - centerY);
  return others.every((other) => distanceTo(circle) < distanceTo(other));
}

function candidatesOf(
  spec: MarkerSpec,
  circle: Circle,
  circles: readonly Circle[],
  names: readonly Rect[],
  frame: PlacementFrame,
): readonly Candidate[] {
  const others = circles.filter(({ id }) => id !== circle.id);
  const slack = Math.max(0, spec.radius - frame.gap);
  return spec.names.flatMap((option) =>
    NAME_SLACK_STEPS.flatMap((step) =>
      NAME_SIDES.map<Candidate>((side) => {
        const size = { width: option.width, height: spec.nameHeight };
        const box = nameBox(circle, side, size, frame.gap + step * slack);
        const nearest = isNearest(box, circle, others);
        const covered = coverageOf(box, others, names, frame);
        return { text: option.text, side, box, covered, nearest };
      }),
    ),
  );
}

/** What a spot costs: what it covers, and a great deal more when the name would read as another's. */
function costOf({ covered, nearest }: Candidate): number {
  return covered + (nearest ? 0 : NOT_NEAREST_PENALTY);
}

/**
 * The first free spot that belongs to its circle (the whole name first, below the circle first),
 * else the one that costs the least; the name is always drawn, and a circle is never covered by
 * choice: the name is what gives way.
 */
function chooseName(candidates: readonly Candidate[]): Candidate {
  const free = candidates.find((candidate) => costOf(candidate) === 0);
  if (free !== undefined) {
    return free;
  }
  return candidates.reduce((best, next) => (costOf(next) < costOf(best) ? next : best));
}

/** How many spots the whole name has without any other name in the way: the fewer, the earlier it is placed. */
function roomOf(
  spec: MarkerSpec,
  circle: Circle,
  circles: readonly Circle[],
  frame: PlacementFrame,
) {
  const whole = spec.names.slice(0, 1);
  return candidatesOf({ ...spec, names: whole }, circle, circles, [], frame).filter(
    (candidate) => costOf(candidate) === 0,
  ).length;
}

/**
 * Where each marker goes: the circle is on its point (only a point outside the zone is brought in)
 * and the name hugs it, nearer to it than to any other circle. The name is tried whole first, below,
 * above, at the sides and the diagonals; the first free spot wins, else the cheapest. Markers with
 * the fewest free spots go first (then by id), with no random number: same lineup, same screen.
 */
export function placeMarkers(
  frame: PlacementFrame,
  markers: readonly MarkerSpec[],
): readonly PlacedMarker[] {
  const byId = [...markers].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const circles = byId.map((spec) => circleAt(spec, frame));
  const room = new Map(
    byId.map((spec, index) => [spec.id, roomOf(spec, circles[index] as Circle, circles, frame)]),
  );
  const ordered = [...byId].sort((a, b) => (room.get(a.id) ?? 0) - (room.get(b.id) ?? 0));
  return ordered.reduce<readonly PlacedMarker[]>((done, spec) => {
    const circle = circles[byId.indexOf(spec)] as Circle;
    const taken = done.map(({ name }) => name.box);
    const choice = chooseName(candidatesOf(spec, circle, circles, taken, frame));
    const name = { text: choice.text, side: choice.side, box: choice.box };
    return [...done, { id: spec.id, x: circle.x, y: circle.y, name }];
  }, []);
}
