import type { Href } from "expo-router";

export type PendingRoundScreen = "draw" | "court";

/** Screens a round leads to that are not built yet; each owner task removes its own item (E4.6, D1). */
export const PENDING_ROUND_SCREENS: readonly PendingRoundScreen[] = [];

export function createRoundHref(groupId: string): Href {
  return { pathname: "/groups/[groupId]/rounds/new", params: { groupId } };
}

export function editRoundHref(groupId: string, roundId: string): Href {
  return { pathname: "/groups/[groupId]/rounds/new", params: { groupId, roundId } };
}

export function roundHref(groupId: string, roundId: string): Href {
  return { pathname: "/groups/[groupId]/rounds/[roundId]", params: { groupId, roundId } };
}

export function addPlayerHref(groupId: string, roundId: string): Href {
  return { pathname: "/groups/[groupId]/rounds/[roundId]/add", params: { groupId, roundId } };
}

/** Screen 07, the draw (E4.7). */
export function drawHref(groupId: string, roundId: string): Href {
  return { pathname: "/groups/[groupId]/rounds/[roundId]/draw", params: { groupId, roundId } };
}
