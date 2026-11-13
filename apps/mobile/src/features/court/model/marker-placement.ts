import { HALF, PERCENT } from "../court.data";
import { placeOnHalfCourt, type CourtEnd } from "./court-geometry";

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

function overlapArea(a: Rect, b: Rect): number {
  const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return width > 0 && height > 0 ? width * height : 0;
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

function verticalSide(circle: Circle, spec: MarkerSpec, frame: PlacementFrame): NameSide {
  const bottom = circle.y + circle.reach + frame.gap + spec.nameHeight;
  return bottom <= frame.bounds.bottom ? "below" : "above";
}

function nameRows(circle: Circle, side: NameSide, height: number, gap: number) {
  return side === "below"
    ? { top: circle.y + circle.reach + gap, bottom: circle.y + circle.reach + gap + height }
    : { top: circle.y - circle.reach - gap - height, bottom: circle.y - circle.reach - gap };
}

interface Row {
  readonly circle: Circle;
  readonly spec: MarkerSpec;
  readonly side: NameSide;
  readonly top: number;
  readonly bottom: number;
}

function rowsOverlap(a: Row, b: { top: number; bottom: number }, air: number): boolean {
  return a.top < b.bottom + air && a.bottom > b.top - air;
}

/**
 * The half width a name can take around its own circle: it may not reach the circle of a neighbour
 * on its row, and shares the distance to the name of a neighbour that stands on the same row.
 */
function halfRoomOf(row: Row, rows: readonly Row[], gap: number): number {
  return rows
    .filter((other) => other.circle.id !== row.circle.id)
    .reduce((room, other) => {
      const distance = Math.abs(other.circle.x - row.circle.x);
      const circleRows = {
        top: other.circle.y - other.circle.reach,
        bottom: other.circle.y + other.circle.reach,
      };
      const blockedByCircle = rowsOverlap(row, circleRows, gap)
        ? distance - other.circle.reach - gap
        : Infinity;
      const sharedWithName = rowsOverlap(row, other, gap) ? (distance - gap) / HALF : Infinity;
      return Math.min(room, blockedByCircle, sharedWithName);
    }, Infinity);
}

/** The name stays inside the zone and out of the column of the team, on the side of its circle. */
function horizontalLimits(row: Row, frame: PlacementFrame): { low: number; high: number } {
  const { left, right } = frame.bounds;
  const { column } = frame;
  if (column === null || !rowsOverlap(row, column, 0)) {
    return { low: left, high: right };
  }
  return row.circle.x >= (column.left + column.right) / HALF
    ? { low: Math.max(left, column.right), high: right }
    : { low: left, high: Math.min(right, column.left) };
}

function placeName(row: Row, rows: readonly Row[], frame: PlacementFrame): PlacedMarker["name"] {
  const { low, high } = horizontalLimits(row, frame);
  const half = Math.min(halfRoomOf(row, rows, frame.gap), row.circle.x - low, high - row.circle.x);
  const names = row.spec.names;
  const chosen = names.find((option) => option.width <= half * HALF) ?? names[names.length - 1];
  const { text, width } = chosen ?? { text: "", width: 0 };
  const left = keepInside(row.circle.x, width / HALF, low, high) - width / HALF;
  return {
    text,
    side: row.side,
    box: { left, right: left + width, top: row.top, bottom: row.bottom },
  };
}

/**
 * Where each marker goes: the circle is on its point (only a point outside the zone is brought in)
 * and the name is centered directly below it, or directly above it at the bottom edge. The name is
 * the whole one when it fits the width around its circle, else the longest shortened one that does;
 * it is always drawn and kept inside the zone. No random number: same lineup, same screen.
 */
export function placeMarkers(
  frame: PlacementFrame,
  markers: readonly MarkerSpec[],
): readonly PlacedMarker[] {
  const byId = [...markers].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const rows = byId.map<Row>((spec) => {
    const circle = circleAt(spec, frame);
    const side = verticalSide(circle, spec, frame);
    return { circle, spec, side, ...nameRows(circle, side, spec.nameHeight, frame.gap) };
  });
  return rows.map((row) => ({
    id: row.spec.id,
    x: row.circle.x,
    y: row.circle.y,
    name: placeName(row, rows, frame),
  }));
}
