import type {
  InviteLinkStore,
  StoredInviteLink,
} from "../features/groups/ports/invite-link-store";

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
  const state = { links: initial, calls: [] as readonly string[] };
  const record = (call: string) => {
    state.calls = [...state.calls, call];
  };
  return {
    read: (groupId) => {
      record(`read:${groupId}`);
      return Promise.resolve(state.links[groupId] ?? null);
    },
    save: (groupId, link) => {
      record(`save:${groupId}`);
      state.links = { ...state.links, [groupId]: link };
      return Promise.resolve();
    },
    remove: (groupId) => {
      record(`remove:${groupId}`);
      state.links = Object.fromEntries(
        Object.entries(state.links).filter(([id]) => id !== groupId),
      );
      return Promise.resolve();
    },
    clearAll: () => {
      record("clearAll");
      state.links = {};
      return Promise.resolve();
    },
    snapshot: () => state.links,
    calls: () => state.calls,
  };
}
