import type { CourtPoint } from "@sacou/volley-rules";

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
  /** The radius of the circle itself. */
  readonly radius: number;
  /** The radius with the room of the badges that stick out of it. */
  readonly reach: number;
  /** The name from the whole one to the shortest; the first one that finds room is drawn. */
  readonly names: readonly NameOption[];
  readonly nameHeight: number;
}
