import type { StoredInviteLink } from "../features/groups/ports/invite-link-store";

/** The keys of the system store accept only letters, digits, ".", "-" and "_". */
const SAFE_KEY_PART = /^[A-Za-z0-9-]{1,64}$/;
const KEY_PREFIX = "sacou.invite.";
export const INVITE_INDEX_KEY = "sacou.invite-index";

/** The key of a group's link, or `null` for an ID that is not safe to use as a key. */
export function inviteKeyOf(groupId: string): string | null {
  return SAFE_KEY_PART.test(groupId) ? `${KEY_PREFIX}${groupId}` : null;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

/** What was stored, read back with care: anything else is as if nothing was stored. */
export function decodeInviteLink(raw: string | null): StoredInviteLink | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return null;
    const { inviteId, token } = value;
    return typeof inviteId === "string" && typeof token === "string" ? { inviteId, token } : null;
  } catch {
    return null;
  }
}

export function encodeInviteLink(link: StoredInviteLink): string {
  return JSON.stringify({ inviteId: link.inviteId, token: link.token });
}

/** The groups that have a link stored: the system store cannot list its own keys. */
export function decodeIndex(raw: string | null): readonly string[] {
  if (raw === null) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}
