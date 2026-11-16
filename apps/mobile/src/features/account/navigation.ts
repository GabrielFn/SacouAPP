import type { Href } from "expo-router";

/** The account screens (screen 30 and what it opens). */
export const accountRoutes = {
  account: "/account",
  editProfile: "/account/profile",
  deleteAccount: "/account/delete",
  notifications: "/notifications",
} as const satisfies Readonly<Record<string, Href>>;

export type AccountScreenName = "export" | "delete";

/**
 * Screens of the account that are not built yet: their rows hide until they are (the pattern of E4.6).
 * Empty since E4.3, part 3, brought "Exportar meus dados" (30a) and "Excluir conta" (30b).
 */
export const PENDING_ACCOUNT_SCREENS: ReadonlySet<AccountScreenName> = new Set();

export function isAccountScreenReady(
  screen: AccountScreenName,
  pending: ReadonlySet<AccountScreenName> = PENDING_ACCOUNT_SCREENS,
): boolean {
  return !pending.has(screen);
}
