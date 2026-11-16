import type { PlayingPosition, PrimaryPosition } from "../../../services/api/sacou-api";

/** The concrete positions in the canonical order of `perfil-e-nota.md` (the order the API keeps). */
export const PLAYING_POSITIONS: readonly PlayingPosition[] = [
  "setter",
  "outsideHitter",
  "opposite",
  "middleBlocker",
  "libero",
];

/** The chips of "Posição principal": the concrete ones and "Qualquer uma" last (Onboarding.dc.html). */
export const PRIMARY_POSITIONS: readonly PrimaryPosition[] = [...PLAYING_POSITIONS, "any"];

/** The concrete positions in the canonical order, whatever the order of the taps. */
export function inCanonicalOrder(
  positions: readonly PlayingPosition[],
): readonly PlayingPosition[] {
  return PLAYING_POSITIONS.filter((position) => positions.includes(position));
}
