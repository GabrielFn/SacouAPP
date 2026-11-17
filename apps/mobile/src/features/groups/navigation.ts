import type { Href } from "expo-router";

import { createRoundHref } from "../rounds/navigation";
import { isFromScratch, serializeCustomBlocks, type GroupOrigin } from "./model/custom-blocks";

export type PendingGroupScreen = "createGroup" | "members" | "settings";

/** Screens of the groups area that are not built yet; each owner task removes its own item (E4.4, D1). */
export const PENDING_GROUP_SCREENS: readonly PendingGroupScreen[] = [];

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

export function groupMembersHref(groupId: string): Href {
  return { pathname: "/groups/[groupId]/members", params: { groupId } };
}

/** Screen 19d. Only the group travels on the route: never the token (ADR 0049, D7). */
export function groupInviteHref(groupId: string): Href {
  return { pathname: "/groups/[groupId]/invite", params: { groupId } };
}

/** Screen 19b. Only the group travels on the route: never a level (ADR 0047). */
export function groupRatingsHref(groupId: string): Href {
  return { pathname: "/groups/[groupId]/ratings", params: { groupId } };
}

export function queueRuleHref(groupId: string): Href {
  return { pathname: "/groups/[groupId]/queue-rule", params: { groupId } };
}

/** Where "Criar grupo" goes next: "Nova rodada" with the pattern the group just got (E4.6, question 48). */
export function afterCreateGroupHref(groupId: string): Href {
  return createRoundHref(groupId);
}

/** The part of the router the wizard needs to leave; a fake in the tests. */
export interface WizardExitRouter {
  readonly dismissAll: () => void;
  readonly push: (href: Href) => void;
}

/**
 * Leaves the wizard (screens 04, 04a and 05) for "Nova rodada" without keeping it in the stack, so going
 * back from the round lands on the screen the wizard was opened from, never on a second, duplicate group.
 */
export function leaveWizardForNewRound(router: WizardExitRouter, groupId: string): void {
  router.dismissAll();
  router.push(afterCreateGroupHref(groupId));
}
