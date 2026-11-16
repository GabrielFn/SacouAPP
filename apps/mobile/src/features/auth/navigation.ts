/**
 * The routes of the root stack, split by the session gate (ADR 0057, D3). Every route of `src/app`
 * is in one list: `navigation.test.ts` reads the folder, so a new screen cannot skip the gate.
 */
export const SIGNED_OUT_ROUTES = ["sign-in"] as const;

export const SIGNED_IN_ROUTES = [
  "(tabs)",
  "notifications",
  "court/[courtSessionId]",
  "dev/catalog",
  "dev/court",
  "dev/replay-benchmark",
  "groups/new/index",
  "groups/new/details",
  "groups/new/custom",
  "groups/[groupId]/invite",
  "groups/[groupId]/members",
  "groups/[groupId]/queue-rule",
  "groups/[groupId]/ratings",
  "groups/[groupId]/settings",
  "groups/[groupId]/rounds/new",
  "groups/[groupId]/rounds/[roundId]/index",
  "groups/[groupId]/rounds/[roundId]/add",
] as const;
