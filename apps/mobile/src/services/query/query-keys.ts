/**
 * Every key of the server cache (E4.2, D6). Slices use this, never an array literal. A key holds only the
 * resource and its ID: never a token, a `userId`, an invite token nor typed text.
 */
export const queryKeys = {
  me: () => ["me"] as const,
  /** The person's own profile, with the level they suggest: outside the persisted allow list. */
  myProfile: () => ["me", "profile"] as const,
  /** Only the nickname, kept on disk for the greeting without a network: the profile itself stays out. */
  myNickname: () => ["me", "nickname"] as const,
  /** What keeps the account from being deleted (screen 30b): outside the persisted allow list. */
  deletionBlockers: () => ["me", "deletion-blockers"] as const,
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
};

export type SacouQueryKey = readonly unknown[];

/** The group a key belongs to, when it is under `["groups", groupId]`. */
export function groupIdOf(key: SacouQueryKey): string | null {
  const [root, groupId] = key;
  return root === "groups" && typeof groupId === "string" ? groupId : null;
}
