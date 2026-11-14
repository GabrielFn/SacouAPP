import type { Href } from "expo-router";

import { createRoundHref } from "../rounds/navigation";
import { isFromScratch, serializeCustomBlocks, type GroupOrigin } from "./model/custom-blocks";

export type PendingGroupScreen = "createGroup" | "members" | "settings";

/** Screens of the groups area that are not built yet; each owner task removes its own item (E4.4, D1). */
export const PENDING_GROUP_SCREENS: readonly PendingGroupScreen[] = ["members"];

export const homeHref: Href = "/";
export const groupsHref: Href = "/groups";
export const meHref: Href = "/me";
export const notificationsHref: Href = "/notifications";
export const createGroupHref: Href = "/groups/new";
export const createGroupCustomHref: Href = "/groups/new/custom";

/** The template chosen on screen 04 and the blocks of 04a travel on the route: its only place (E4.5, D1). */
export const TEMPLATE_PARAM = "template";
export const BLOCKS_PARAM = "blocks";

export function createGroupDetailsHref(origin: GroupOrigin): Href {
  const params = isFromScratch(origin)
    ? { [TEMPLATE_PARAM]: origin.templateKey, [BLOCKS_PARAM]: serializeCustomBlocks(origin.blocks) }
    : { [TEMPLATE_PARAM]: origin.templateKey };
  return { pathname: "/groups/new/details", params };
}

export function groupSettingsHref(groupId: string): Href {
  return { pathname: "/groups/[groupId]/settings", params: { groupId } };
}

/** Where "Criar grupo" goes next: "Nova rodada" with the pattern the group just got (E4.6, question 48). */
export function afterCreateGroupHref(groupId: string): Href {
  return createRoundHref(groupId);
}
