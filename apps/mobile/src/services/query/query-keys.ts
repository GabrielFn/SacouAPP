/**
 * Every key of the server cache (E4.2, D6). Slices use this, never an array literal. A key holds only the
 * resource and its ID: never a token, a `userId`, an invite token nor typed text.
 */
export const queryKeys = {
  me: () => ["me"] as const,
  groups: () => ["groups"] as const,
  group: (groupId: string) => ["groups", groupId] as const,
  members: (groupId: string) => ["groups", groupId, "members"] as const,
  invites: (groupId: string) => ["groups", groupId, "invites"] as const,
};

export type SacouQueryKey = readonly unknown[];

/** The group a key belongs to, when it is under `["groups", groupId]`. */
export function groupIdOf(key: SacouQueryKey): string | null {
  const [root, groupId] = key;
  return root === "groups" && typeof groupId === "string" ? groupId : null;
}
