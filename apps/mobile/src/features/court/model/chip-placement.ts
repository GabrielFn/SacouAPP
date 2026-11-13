import type { CourtPoint } from "@sacou/volley-rules";

import { CHIP_SEPARATION_PASSES, PERCENT } from "../court.data";
import { placeOnHalfCourt, type CourtEnd } from "./court-geometry";

/** A rectangle in pixels; the origin is the top left corner of the half court square. */
export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** What a chip needs to be placed: where the formation puts it and how big its box is. */
export interface ChipSpec {
  readonly id: string;
  readonly point: CourtPoint;
  /** Half the width and half the height of the box, with room for the badge that sticks out. */
  readonly halfWidth: number;
  readonly halfHeight: number;
}

export interface PlacedChip {
  readonly id: string;
  /** The center of the chip, in pixels from the top left corner of the square. */
  readonly x: number;
  readonly y: number;
}

export interface PlacementFrame {
  readonly end: CourtEnd;
  /** The side of the square, in pixels. */
  readonly side: number;
  /** A chip box stays inside this (the zone, ending at the net). */
  readonly bounds: Rect;
  /** A chip box never covers this (the column of the team), or `null`. */
  readonly column: Rect | null;
  /** The air kept between two chips. */
  readonly gap: number;
}

interface Box {
  readonly id: string;
  readonly halfWidth: number;
  readonly halfHeight: number;
  readonly x: number;
  readonly y: number;
}

const HALF = 2;
/** The packing looks at spots this many pixels apart. */
const SEARCH_STEP = 3;

function edgesOf(box: Box): Rect {
  return {
    left: box.x - box.halfWidth,
    right: box.x + box.halfWidth,
    top: box.y - box.halfHeight,
    bottom: box.y + box.halfHeight,
  };
}

/** Keeps a box inside the rectangle; a box bigger than it is centered. */
function clampInto(box: Box, bounds: Rect): Box {
  const fit = (center: number, half: number, low: number, high: number) =>
    high - low < half * HALF
      ? (low + high) / HALF
      : Math.min(high - half, Math.max(low + half, center));
  return {
    ...box,
    x: fit(box.x, box.halfWidth, bounds.left, bounds.right),
    y: fit(box.y, box.halfHeight, bounds.top, bounds.bottom),
  };
}

/** Moves a box out of the column by the way that costs the least. */
function leaveColumn(box: Box, column: Rect | null): Box {
  if (column === null) {
    return box;
  }
  const edges = edgesOf(box);
  const overlapsX = edges.left < column.right && edges.right > column.left;
  const overlapsY = edges.top < column.bottom && edges.bottom > column.top;
  if (!overlapsX || !overlapsY) {
    return box;
  }
  const exits = [
    { axis: "x", cost: edges.right - column.left, shift: column.left - edges.right },
    { axis: "x", cost: column.right - edges.left, shift: column.right - edges.left },
    { axis: "y", cost: edges.bottom - column.top, shift: column.top - edges.bottom },
    { axis: "y", cost: column.bottom - edges.top, shift: column.bottom - edges.top },
  ] as const;
  const best = exits.reduce((a, b) => (b.cost < a.cost ? b : a));
  return best.axis === "x" ? { ...box, x: box.x + best.shift } : { ...box, y: box.y + best.shift };
}

/** Which way a pair is pushed apart: along the shorter way out, or always along x or along y. */
type Strategy = "nearest" | "horizontal" | "vertical";

const STRATEGIES: readonly Strategy[] = ["nearest", "horizontal", "vertical"];

function pushAlongX(penetrationX: number, penetrationY: number, strategy: Strategy): boolean {
  switch (strategy) {
    case "nearest":
      return penetrationX < penetrationY;
    case "horizontal":
      return true;
    case "vertical":
      return false;
  }
}

/** Pushes two boxes that cover each other (or are closer than the gap) apart, half each. */
function separate(first: Box, second: Box, gap: number, strategy: Strategy): readonly [Box, Box] {
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const penetrationX = first.halfWidth + second.halfWidth + gap - Math.abs(dx);
  const penetrationY = first.halfHeight + second.halfHeight + gap - Math.abs(dy);
  if (penetrationX <= 0 || penetrationY <= 0) {
    return [first, second];
  }
  // A tie of position goes to the later chip.
  if (pushAlongX(penetrationX, penetrationY, strategy)) {
    const shift = (penetrationX / HALF) * (dx < 0 ? -1 : 1);
    return [
      { ...first, x: first.x - shift },
      { ...second, x: second.x + shift },
    ];
  }
  const shift = (penetrationY / HALF) * (dy < 0 ? -1 : 1);
  return [
    { ...first, y: first.y - shift },
    { ...second, y: second.y + shift },
  ];
}

/** Takes every pair once, in order, and each push sees the boxes the pushes before it left. */
function separateAll(boxes: readonly Box[], gap: number, strategy: Strategy): readonly Box[] {
  const pairs = boxes.flatMap((_, i) =>
    boxes.slice(i + 1).map((__, offset) => [i, i + 1 + offset] as const),
  );
  return pairs.reduce((current, [i, j]) => {
    const [first, second] = separate(current[i] as Box, current[j] as Box, gap, strategy);
    return current.map((box, index) => (index === i ? first : index === j ? second : box));
  }, boxes);
}

function keepInPlace(list: readonly Box[], frame: PlacementFrame): readonly Box[] {
  return list.map((box) =>
    clampInto(leaveColumn(clampInto(box, frame.bounds), frame.column), frame.bounds),
  );
}

function sameSpots(first: readonly Box[], second: readonly Box[]): boolean {
  return first.every((box, index) => {
    const other = second[index];
    return other !== undefined && box.x === other.x && box.y === other.y;
  });
}

/** Pushes and keeps in place, pass after pass, until nothing moves or the passes run out. */
function settle(
  boxes: readonly Box[],
  frame: PlacementFrame,
  strategy: Strategy,
  passesLeft: number = CHIP_SEPARATION_PASSES,
): readonly Box[] {
  if (passesLeft === 0) {
    return boxes;
  }
  const moved = keepInPlace(separateAll(boxes, frame.gap, strategy), frame);
  return sameSpots(moved, boxes) ? moved : settle(moved, frame, strategy, passesLeft - 1);
}

function overlapArea(a: Rect, b: Rect): number {
  const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return width > 0 && height > 0 ? width * height : 0;
}

/** How much of the boxes still covers each other or the column: zero is a clean placement. */
function coverage(boxes: readonly Box[], column: Rect | null): number {
  return boxes.reduce((total, box, index) => {
    const edges = edgesOf(box);
    const withColumn = column === null ? 0 : overlapArea(edges, column);
    const withOthers = boxes
      .slice(index + 1)
      .reduce((sum, other) => sum + overlapArea(edges, edgesOf(other)), 0);
    return total + withColumn + withOthers;
  }, 0);
}

/** Every spot a box could take inside the bounds, the nearest to where it wanted to be first. */
function candidatesNear(box: Box, bounds: Rect): readonly Box[] {
  const columns = Math.floor((bounds.right - bounds.left - box.halfWidth * HALF) / SEARCH_STEP) + 1;
  const rows = Math.floor((bounds.bottom - bounds.top - box.halfHeight * HALF) / SEARCH_STEP) + 1;
  const spots = Array.from({ length: Math.max(0, columns * rows) }, (_, index) => ({
    ...box,
    x: bounds.left + box.halfWidth + (index % columns) * SEARCH_STEP,
    y: bounds.top + box.halfHeight + Math.floor(index / columns) * SEARCH_STEP,
  }));
  const distance = (spot: Box) => (spot.x - box.x) ** HALF + (spot.y - box.y) ** HALF;
  return spots.toSorted((a, b) => distance(a) - distance(b) || a.y - b.y || a.x - b.x);
}

function isFree(spot: Box, placed: readonly Box[], frame: PlacementFrame): boolean {
  const edges = edgesOf(spot);
  const clearOfColumn = frame.column === null || overlapArea(edges, frame.column) === 0;
  const apart = (other: Box) =>
    Math.abs(spot.x - other.x) >= spot.halfWidth + other.halfWidth + frame.gap ||
    Math.abs(spot.y - other.y) >= spot.halfHeight + other.halfHeight + frame.gap;
  return clearOfColumn && placed.every(apart);
}

/**
 * The last resort when pushing apart leaves boxes covered: one by one, in the order of their ids,
 * each takes the free spot nearest to where its point wanted it, so a spot is found whenever there
 * is room for it at all.
 */
function packOneByOne(boxes: readonly Box[], frame: PlacementFrame): readonly Box[] {
  return boxes.reduce<readonly Box[]>((placed, box) => {
    const wanted = clampInto(box, frame.bounds);
    const spot = candidatesNear(wanted, frame.bounds).find((candidate) =>
      isFree(candidate, placed, frame),
    );
    return [...placed, spot ?? wanted];
  }, []);
}

/** The first way of pushing that leaves nothing covered, then packing one by one, else the least covered. */
function bestSettlement(boxes: readonly Box[], frame: PlacementFrame): readonly Box[] {
  const pushed = STRATEGIES.map((strategy) => settle(boxes, frame, strategy));
  const clean = pushed.find((option) => coverage(option, frame.column) === 0);
  if (clean !== undefined) {
    return clean;
  }
  const packed = packOneByOne(boxes, frame);
  return [...pushed, packed].reduce((best, option) =>
    coverage(option, frame.column) < coverage(best, frame.column) ? option : best,
  );
}

/**
 * Where each chip of a team goes, in pixels. It starts at the point of the formation (turned to the
 * end of the screen), then keeps every box inside the zone (never past the net), out of the column of
 * the team and clear of the others. The server stands behind the end line while there is room there;
 * otherwise the column pushes it in. Chips are taken in the order of their id and no random number
 * is used, so the same lineup always gives the same screen.
 */
export function placeChips(
  frame: PlacementFrame,
  chips: readonly ChipSpec[],
): readonly PlacedChip[] {
  const ordered = [...chips].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const boxes = ordered.map<Box>((chip) => {
    const place = placeOnHalfCourt(chip.point, frame.end);
    return {
      id: chip.id,
      halfWidth: chip.halfWidth,
      halfHeight: chip.halfHeight,
      x: (place.x / PERCENT) * frame.side,
      y: (place.y / PERCENT) * frame.side,
    };
  });
  return bestSettlement(boxes, frame).map(({ id, x, y }) => ({ id, x, y }));
}
