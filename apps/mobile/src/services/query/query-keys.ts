/**
 * Every key of the server cache (E4.2, D6). Slices use this, never an array literal. A key holds only the
 * resource and its ID: never a token, a `userId`, an invite token nor typed text.
 */
export const queryKeys = {
  /** The minimum build and the flags (ADR 0084): no person's data, persisted so a known answer holds offline. */
  appConfig: () => ["app-config"] as const,
  me: () => ["me"] as const,
  /** The person's own profile, the one record of the nickname; on disk only the nickname goes (ADR 0057, D9). */
  myProfile: () => ["me", "profile"] as const,
  /** The person's own numbers (screen 14): the server picks the season; persisted, with no rating in it. */
  myStats: () => ["me", "stats"] as const,
  /** What keeps the account from being deleted (screen 30b): outside the persisted allow list. */
  deletionBlockers: () => ["me", "deletion-blockers"] as const,
  /**
   * Screen 28 and the dot of the bell (E3.11): outside the persisted allow list, the list opens online
   * and the dot is derived from its `unreadCount`, never kept apart.
   */
  notifications: () => ["me", "notifications"] as const,
  groups: () => ["groups"] as const,
  group: (groupId: string) => ["groups", groupId] as const,
  members: (groupId: string) => ["groups", groupId, "members"] as const,
  invites: (groupId: string) => ["groups", groupId, "invites"] as const,
  /** The admin's levels and the suggestions: outside the persisted allow list (ADR 0047). */
  memberLevels: (groupId: string) => ["groups", groupId, "member-levels"] as const,
  settings: (groupId: string) => ["groups", groupId, "settings"] as const,
  templates: (groupId: string) => ["groups", groupId, "templates"] as const,
  rounds: (groupId: string) => ["groups", groupId, "rounds"] as const,
  round: (groupId: string, roundId: string) => ["groups", groupId, "rounds", roundId] as const,
  /** Who marks the court of a round and its score (screen 09a): outside the persisted allow list. */
  courtSummary: (groupId: string, roundId: string) =>
    ["groups", groupId, "rounds", roundId, "court-session"] as const,
  /** The numbers of a round (screen 12): persisted, so the last summary seen opens offline (E4.12). */
  roundSummary: (groupId: string, roundId: string) =>
    ["groups", groupId, "rounds", roundId, "summary"] as const,
  /**
   * The MVP ballot of the person (screen 12a), with their own vote: outside the persisted allow list, so
   * the vote is never written on the phone (E4.18, question 178).
   */
  mvpVoting: (groupId: string, roundId: string) =>
    ["groups", groupId, "rounds", roundId, "mvp-voting"] as const,
  /** Points of a round this phone has not sent yet, counted from the court log: never persisted. */
  courtUnsent: (roundId: string) => ["court-unsent", roundId] as const,
  /** Where a court session came from, read from the court log: outside the persisted allow list. */
  courtSessionOrigin: (courtSessionId: string) => ["court-session-origin", courtSessionId] as const,
};

export type SacouQueryKey = readonly unknown[];

/** The group a key belongs to, when it is under `["groups", groupId]`. */
export function groupIdOf(key: SacouQueryKey): string | null {
  const [root, groupId] = key;
  return root === "groups" && typeof groupId === "string" ? groupId : null;
}
