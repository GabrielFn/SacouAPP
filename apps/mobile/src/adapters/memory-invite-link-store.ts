import type { InviteLinkStore, StoredInviteLink } from "../features/groups/ports/invite-link-store";

export interface MemoryInviteLinkStore extends InviteLinkStore {
  /** What is stored now, by group. */
  readonly snapshot: () => Readonly<Record<string, StoredInviteLink>>;
  /** Every call in order, by name and group, never with the token. */
  readonly calls: () => readonly string[];
}

/** The fake of the tests: the same contract, in memory. */
export function createMemoryInviteLinkStore(
  initial: Readonly<Record<string, StoredInviteLink>> = {},
): MemoryInviteLinkStore {
  const links = { value: initial };
  const log = { value: [] as readonly string[] };
  const record = (call: string) => {
    log.value = [...log.value, call];
  };
  return {
    read: (groupId) => {
      record(`read:${groupId}`);
      return Promise.resolve(links.value[groupId] ?? null);
    },
    save: (groupId, link) => {
      record(`save:${groupId}`);
      links.value = { ...links.value, [groupId]: link };
      return Promise.resolve();
    },
    remove: (groupId) => {
      record(`remove:${groupId}`);
      links.value = Object.fromEntries(
        Object.entries(links.value).filter(([id]) => id !== groupId),
      );
      return Promise.resolve();
    },
    clearAll: () => {
      record("clearAll");
      links.value = {};
      return Promise.resolve();
    },
    snapshot: () => links.value,
    calls: () => log.value,
  };
}
