import type { MemberId } from "@sacou/match-engine";

import type {
  NextMatchDraft,
  NextMatchDraftStore,
} from "../features/court/ports/next-match-draft-store";
import type { KeyValueStore } from "../services/query/key-value-store";

/** One row per finished match, beside the persisted cache and apart from it. */
export function nextMatchDraftKey(matchId: string): string {
  return `court:next-match:${matchId}`;
}

function isMemberIds(value: unknown): value is readonly MemberId[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isSidePair(value: unknown): value is Readonly<Record<"a" | "b", readonly MemberId[]>> {
  if (typeof value !== "object" || value === null) return false;
  const { a, b } = value as { readonly a?: unknown; readonly b?: unknown };
  return isMemberIds(a) && isMemberIds(b);
}

/** A stored value is read as the app wrote it, or not at all. */
function parseDraft(raw: string): NextMatchDraft | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const { drawOrder, chosen } = value as {
      readonly drawOrder?: unknown;
      readonly chosen?: unknown;
    };
    const drawOk = drawOrder === null || isSidePair(drawOrder);
    return drawOk && isSidePair(chosen) ? { drawOrder, chosen } : null;
  } catch {
    return null;
  }
}

/**
 * The drafts of the next match over a `KeyValueStore` (the real one is a row of `sacou-cache.db`).
 * A store that fails reads as no draft: the screen makes a new one.
 */
export function createStoredNextMatchDrafts(store: KeyValueStore): NextMatchDraftStore {
  return {
    async load(matchId) {
      const raw = await store.getItem(nextMatchDraftKey(matchId)).catch(() => null);
      return raw === null ? null : parseDraft(raw);
    },
    save: (matchId, draft) => store.setItem(nextMatchDraftKey(matchId), JSON.stringify(draft)),
    clear: (matchId) => store.removeItem(nextMatchDraftKey(matchId)),
  };
}
