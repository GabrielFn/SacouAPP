import type { SettingsTemplateKey } from "@sacou/match-engine";
import type { Href } from "expo-router";

export type PendingGroupScreen = "createGroup" | "members" | "settings";

/** Screens of the groups area that are not built yet; each owner task removes its own item (E4.4, D1). */
export const PENDING_GROUP_SCREENS: readonly PendingGroupScreen[] = ["members"];

export const homeHref: Href = "/";
export const groupsHref: Href = "/groups";
export const meHref: Href = "/me";
export const notificationsHref: Href = "/notifications";
export const createGroupHref: Href = "/groups/new";

/** The template chosen on screen 04 travels on the route: the router is its only place (E4.5, D1). */
export const TEMPLATE_PARAM = "template";

export function createGroupDetailsHref(templateKey: SettingsTemplateKey): Href {
  return { pathname: "/groups/new/details", params: { [TEMPLATE_PARAM]: templateKey } };
}

export function groupSettingsHref(groupId: string): Href {
  return { pathname: "/groups/[groupId]/settings", params: { groupId } };
}

/** Where "Criar grupo" goes next: the settings, until the members (E4.5 part 2) and the round (E4.6). */
export function afterCreateGroupHref(groupId: string): Href {
  return groupSettingsHref(groupId);
}
