import type { Href } from "expo-router";

/** The routes of the "Eu" tab beyond the account ones. */
export const meRoutes = {
  card: "/me/card",
} as const satisfies Readonly<Record<string, Href>>;
