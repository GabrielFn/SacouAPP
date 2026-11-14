import type { Href } from "expo-router";

export type PendingRoundScreen = "draw" | "court";

/** Screens a round leads to that are not built yet; each owner task removes its own item (E4.6, D1). */
export const PENDING_ROUND_SCREENS: readonly PendingRoundScreen[] = ["draw", "court"];

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
