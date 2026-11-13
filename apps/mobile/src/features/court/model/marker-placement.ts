import type { CourtPoint } from "@sacou/volley-rules";

import { HALF, PERCENT } from "../court.data";
import { placeOnHalfCourt, type CourtEnd } from "./court-geometry";

/** A rectangle in pixels; the origin is the top left corner of the half court square. */
export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** One way to write a name, with the width it takes. */
export interface NameOption {
  readonly text: string;
  readonly width: number;
}

/** What a marker needs to be placed: the point of the formation, its circle and the sizes of its name. */
export interface MarkerSpec {
  readonly id: string;
  readonly point: CourtPoint;
  /** The radius of the circle, with the room of the badges that stick out of it. */
  readonly reach: number;
  /** The name from the whole one to the shortest; the first one that finds room is drawn. */
  readonly names: readonly NameOption[];
  readonly nameHeight: number;
}

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

/** The name is tried next to the circle (ring 0) and then one and two lines of name farther away (rings 1 and 2). */
const NAME_RING_COUNT = 3;
const NAME_RINGS: readonly number[] = Array.from({ length: NAME_RING_COUNT }, (_, ring) => ring);

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

interface Circle {
  readonly id: string;
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
  return onCircles * CIRCLE_WEIGHT + onNames + onColumn + outsideArea(box, frame.bounds);
}

function candidatesOf(
  spec: MarkerSpec,
  circle: Circle,
  circles: readonly Circle[],
  names: readonly Rect[],
  frame: PlacementFrame,
): readonly Candidate[] {
  const others = circles.filter(({ id }) => id !== circle.id);
  return spec.names.flatMap((option) =>
    NAME_RINGS.flatMap((ring) =>
      NAME_SIDES.map<Candidate>((side) => {
        const size = { width: option.width, height: spec.nameHeight };
        const distance = frame.gap + ring * (spec.nameHeight + frame.gap);
        const box = nameBox(circle, side, size, distance);
        return { text: option.text, side, box, covered: coverageOf(box, others, names, frame) };
      }),
    ),
  );
}

/**
 * The first free spot (the whole name first, below the circle first), else the one that covers the
 * least, and a circle is never covered by choice: the name is what gives way.
 */
function chooseName(candidates: readonly Candidate[]): Candidate {
  const free = candidates.find(({ covered }) => covered === 0);
  if (free !== undefined) {
    return free;
  }
  return candidates.reduce((best, next) => (next.covered < best.covered ? next : best));
}

/**
 * Where each marker goes. The center of every circle is the point of the formation, turned to the end
 * of the screen: it is never pushed, only a point outside the zone is brought in. The name goes below
 * the circle; where that would cover another circle, another name, the column, the net or the edge of
 * the zone, it goes above, then to the right, to the left and to the diagonals, and the first free
 * spot wins. With none free the name is shortened, and with none still the least covered spot is
 * used. Markers are taken in the order of their id and no random number is used, so the same lineup
 * always gives the same screen.
 */
export function placeMarkers(
  frame: PlacementFrame,
  markers: readonly MarkerSpec[],
): readonly PlacedMarker[] {
  const ordered = [...markers].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const circles = ordered.map((spec) => circleAt(spec, frame));
  return ordered.reduce<readonly PlacedMarker[]>((done, spec, index) => {
    const circle = circles[index] as Circle;
    const taken = done.map(({ name }) => name.box);
    const choice = chooseName(candidatesOf(spec, circle, circles, taken, frame));
    const name = { text: choice.text, side: choice.side, box: choice.box };
    return [...done, { id: spec.id, x: circle.x, y: circle.y, name }];
  }, []);
}
