/**
 * Where each part of the card sits, as a fraction of the card itself (`.kc` of Perfil.dc.html: the inside
 * is 260 x 368 once the 5 of the frame are taken). Percentages, so the card keeps its shape at any size.
 */
const INSIDE_WIDTH = 260;
const INSIDE_HEIGHT = 368;

function percent(part: number, whole: number): `${number}%` {
  return `${Math.round((part / whole) * 10_000) / 100}%`;
}
const ofWidth = (part: number) => percent(part, INSIDE_WIDTH);
const ofHeight = (part: number) => percent(part, INSIDE_HEIGHT);

export const cardLayout = {
  mesh: { height: ofHeight(178) },
  level: { left: ofWidth(16), top: ofHeight(12) },
  avatar: { top: ofHeight(34), right: ofWidth(22), width: ofWidth(116) },
  nameBand: { top: ofHeight(174), height: ofHeight(56) },
  stats: { side: ofWidth(12), top: ofHeight(242) },
  footer: { side: ofWidth(14), bottom: ofHeight(10) },
  /** One of the three columns of the grid of numbers. */
  statColumn: percent(1, 3),
} as const;

/** The mesh of the top (`.kmesh`): two sets of diagonals every `meshStep`, in a box of the width of the card. */
export const MESH_VIEW_BOX = { width: INSIDE_WIDTH, height: 178 } as const;

export function meshPath(step: number): string {
  const { width, height } = MESH_VIEW_BOX;
  const segments: string[] = [];
  for (let offset = -height; offset <= width; offset += step) {
    segments.push(`M${String(offset)} ${String(height)}L${String(offset + height)} 0`);
    segments.push(`M${String(offset)} 0L${String(offset + height)} ${String(height)}`);
  }
  return segments.join("");
}
