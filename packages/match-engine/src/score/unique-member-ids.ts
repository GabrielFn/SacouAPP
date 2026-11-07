import { isUuid } from "../event-log/is-uuid.js";
import type { MemberId } from "./types.js";

/**
 * A list of members from outside the engine: UUIDs, each one once, or `null`. The copy turns holes
 * of a sparse array into undefined, which fails the UUID check.
 */
export function readUniqueMemberIds(raw: unknown): readonly MemberId[] | null {
  if (!Array.isArray(raw)) {
    return null;
  }
  const items: readonly unknown[] = Array.from(raw as readonly unknown[]);
  const memberIds = items.filter(isUuid);
  const isValid = memberIds.length === items.length && new Set(memberIds).size === items.length;
  return isValid ? memberIds : null;
}
