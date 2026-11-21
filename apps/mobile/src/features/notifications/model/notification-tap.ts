import type { NotificationKind } from "../../../services/api/sacou-api";

/** The four fields the server puts in a push (E3.11, Part 2, item 7): only ids and a closed kind. */
export interface NotificationTap {
  readonly kind: NotificationKind;
  readonly notificationId: string;
  readonly groupId: string;
  readonly roundId: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS: ReadonlySet<unknown> = new Set<NotificationKind>(["waitlistPromoted"]);
const FIELDS: ReadonlySet<string> = new Set(["kind", "notificationId", "groupId", "roundId"]);

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function uuidOf(value: unknown): string | null {
  return typeof value === "string" && UUID.test(value) ? value.toLowerCase() : null;
}

/**
 * The `data` of a touched push, or `null`: a closed object with exactly the four fields, ids that are
 * UUIDs and a known kind (section 6, T). Anything else opens the home, never a route built from it.
 */
export function parseNotificationTap(data: unknown): NotificationTap | null {
  if (!isRecord(data)) return null;
  const keys = Object.keys(data);
  if (keys.length !== FIELDS.size || !keys.every((key) => FIELDS.has(key))) return null;
  const notificationId = uuidOf(data.notificationId);
  const groupId = uuidOf(data.groupId);
  const roundId = uuidOf(data.roundId);
  if (notificationId === null || groupId === null || roundId === null) return null;
  if (!KINDS.has(data.kind)) return null;
  return { kind: "waitlistPromoted", notificationId, groupId, roundId };
}

export type TapTarget =
  | { readonly kind: "round"; readonly groupId: string; readonly roundId: string }
  | { readonly kind: "home" };

const HOME: TapTarget = { kind: "home" };

/**
 * Where a touched push leads: the round, when the `data` is valid and the group is one of the person's;
 * the home otherwise. `knownGroupIds` is `null` while the groups were never read: the round screen then
 * answers the access itself (403 or 404), as it does for any link.
 */
export function tapTarget(data: unknown, knownGroupIds: ReadonlySet<string> | null): TapTarget {
  const tap = parseNotificationTap(data);
  if (tap === null) return HOME;
  if (knownGroupIds !== null && !knownGroupIds.has(tap.groupId)) return HOME;
  return { kind: "round", groupId: tap.groupId, roundId: tap.roundId };
}
