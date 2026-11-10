import type { Href } from "expo-router";

/** Screens of the groups area that are not built yet; each owner task removes its own item (E4.4, D1). */
export const PENDING_GROUP_SCREENS = ["createGroup", "members", "settings"] as const;

export type PendingGroupScreen = (typeof PENDING_GROUP_SCREENS)[number];

export const homeHref: Href = "/";
export const groupsHref: Href = "/groups";
export const notificationsHref: Href = "/notifications";
