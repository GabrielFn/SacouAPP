import type { PointKind } from "../score/types.js";

/** Only the server of the rally scores an ace (ADR 0031, P1). */
export const SERVE_POINT_KINDS: readonly PointKind[] = ["ace"];

/** The libero never serves nor blocks, so these are never its points (ADR 0031, P1). */
export const LIBERO_IMPOSSIBLE_POINT_KINDS: readonly PointKind[] = ["ace", "block"];
