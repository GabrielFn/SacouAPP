import type { Href } from "expo-router";

/** The account screens (screen 30 and what it opens). */
export const accountRoutes = {
  account: "/account",
  editProfile: "/account/profile",
  notifications: "/notifications",
} as const satisfies Readonly<Record<string, Href>>;

export type AccountScreenName = "export" | "delete";

/**
 * Screens of the account that are not built yet: their rows hide until they are (the pattern of E4.6).
 * "Exportar meus dados" (30a) and "Excluir conta" (30b) arrive with E4.3, part 3, over E3.16.
 */
export const PENDING_ACCOUNT_SCREENS: ReadonlySet<AccountScreenName> = new Set(["export", "delete"]);

export function isAccountScreenReady(
  screen: AccountScreenName,
  pending: ReadonlySet<AccountScreenName> = PENDING_ACCOUNT_SCREENS,
): boolean {
  return !pending.has(screen);
}
