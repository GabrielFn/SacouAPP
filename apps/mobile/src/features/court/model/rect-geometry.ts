import type { Rect } from "./marker-placement.types";

export function overlapArea(a: Rect, b: Rect): number {
  const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return width > 0 && height > 0 ? width * height : 0;
}

export function within(box: Rect, bounds: Rect): boolean {
  return (
    box.left >= bounds.left &&
    box.right <= bounds.right &&
    box.top >= bounds.top &&
    box.bottom <= bounds.bottom
  );
}

export function collides(box: Rect, other: Rect, air: number): boolean {
  return (
    overlapArea(box, {
      left: other.left - air,
      right: other.right + air,
      top: other.top - air,
      bottom: other.bottom + air,
    }) > 0
  );
}

/** How much of the circles around a name it covers, with the air kept around them. */
export function coveredArea(box: Rect, obstacles: readonly Rect[], gap: number): number {
  return obstacles.reduce(
    (sum, other) =>
      sum +
      overlapArea(box, {
        left: other.left - gap,
        right: other.right + gap,
        top: other.top - gap,
        bottom: other.bottom + gap,
      }),
    0,
  );
}
