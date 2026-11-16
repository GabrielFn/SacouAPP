/**
 * The routes of the root stack, split by the session gate (ADR 0057, D3). Every route of `src/app`
 * is in one list: `navigation.test.ts` reads the folder, so a new screen cannot skip the gate.
 */
export const SIGNED_OUT_ROUTES = ["sign-in"] as const;

export const SIGNED_IN_ROUTES = [
  "(tabs)",
  "notifications",
  "account/index",
  "account/profile",
  "account/delete",
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

/**
 * Signed in, but only while the profile is missing and was not skipped (screen 27, E4.3 D6): the other
 * signed-in routes are closed meanwhile, so the gate takes the person there and back by itself.
 */
export const ONBOARDING_ROUTES = ["onboarding"] as const;
