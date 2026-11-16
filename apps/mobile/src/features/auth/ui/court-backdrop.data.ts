// The court drawn behind the login (Login.dc.html:17-22), in the units of its view box. The drawing
// scales with the width of the screen through `aspectRatio`; nothing here is a size on the screen.
export const BACKDROP_VIEW_BOX = "0 0 390 520";
export const BACKDROP_ASPECT = 0.75;

export const BACKDROP_COURT = { x: 40, y: -80, width: 310, height: 620 } as const;
export const BACKDROP_LINE_WIDTH = 2;
export const BACKDROP_NET_WIDTH = 3;
export const BACKDROP_NET_Y = 230;
export const BACKDROP_ATTACK_LINES_Y = [130, 330] as const;
/** The band of the net mesh, and the 7 units of its diagonal pattern. */
export const BACKDROP_MESH = { y: 222, height: 16, cell: 7, stroke: 1 } as const;
