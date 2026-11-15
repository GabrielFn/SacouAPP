import * as SecureStore from "expo-secure-store";

import type { InviteLinkStore } from "../features/groups/ports/invite-link-store";
import {
  decodeIndex,
  decodeInviteLink,
  encodeInviteLink,
  INVITE_INDEX_KEY,
  inviteKeyOf,
} from "./invite-link-codec";

/** Only on this phone, and only while it is unlocked: never in a backup (ADR 0049, D7). */
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

async function readIndex(): Promise<readonly string[]> {
  return decodeIndex(await SecureStore.getItemAsync(INVITE_INDEX_KEY, OPTIONS));
}

async function writeIndex(groupIds: readonly string[]): Promise<void> {
  await SecureStore.setItemAsync(INVITE_INDEX_KEY, JSON.stringify(groupIds), OPTIONS);
}

async function forget(groupId: string): Promise<void> {
  const key = inviteKeyOf(groupId);
  if (key !== null) await SecureStore.deleteItemAsync(key, OPTIONS);
}

/** An index the system cannot read again is as if empty: sign-out still goes on. */
async function readIndexOrEmpty(): Promise<readonly string[]> {
  try {
    return await readIndex();
  } catch {
    return [];
  }
}

/** The groups whose key could not be deleted: they stay in the index for the next sign-out. */
async function forgetAll(groupIds: readonly string[]): Promise<readonly string[]> {
  const results = await Promise.allSettled(groupIds.map(forget));
  return groupIds.filter((_, position) => results[position]?.status === "rejected");
}

/** The token in the encrypted store of the system (Keystore on Android, Keychain on iOS). */
export const secureStoreInviteLinkStore: InviteLinkStore = {
  read: async (groupId) => {
    const key = inviteKeyOf(groupId);
    if (key === null) return null;
    try {
      return decodeInviteLink(await SecureStore.getItemAsync(key, OPTIONS));
    } catch {
      // A store the system cannot open again (a new lock screen) reads as empty: a new link is made.
      return null;
    }
  },
  save: async (groupId, link) => {
    const key = inviteKeyOf(groupId);
    if (key === null) return;
    // The index first: a key is never stored without `clearAll` knowing of it.
    const index = await readIndex();
    if (!index.includes(groupId)) await writeIndex([...index, groupId]);
    await SecureStore.setItemAsync(key, encodeInviteLink(link), OPTIONS);
  },
  remove: async (groupId) => {
    await forget(groupId);
    const index = await readIndex();
    if (index.includes(groupId)) await writeIndex(index.filter((id) => id !== groupId));
  },
  /** Tries every key and never rejects, so one stuck key does not stop the sign-out. */
  clearAll: async () => {
    const left = await forgetAll(await readIndexOrEmpty());
    try {
      if (left.length === 0) await SecureStore.deleteItemAsync(INVITE_INDEX_KEY, OPTIONS);
      else await writeIndex(left);
    } catch {
      // Nothing else to do here: the next sign-out tries again.
    }
  },
};
