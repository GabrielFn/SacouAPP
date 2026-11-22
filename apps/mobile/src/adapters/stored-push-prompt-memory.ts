import type { PushPromptMemory } from "../features/notifications/ports/push-prompt-memory";
import type { KeyValueStore } from "../services/query/key-value-store";

/** Its own row in `sacou-cache.db`, beside the persisted cache: a flag of the phone, no personal data. */
export const PUSH_PROMPT_KEY = "push-prompt-offered";
const OFFERED = "1";

/**
 * The flag over a `KeyValueStore`: the real one is the row in `sacou-cache.db`, the one of the tests a
 * map in memory. A store that cannot be read counts as offered: better no question than two.
 */
export function createStoredPushPromptMemory(store: KeyValueStore): PushPromptMemory {
  return {
    wasOffered: () =>
      store.getItem(PUSH_PROMPT_KEY).then(
        (value) => value === OFFERED,
        () => true,
      ),
    markOffered: () => store.setItem(PUSH_PROMPT_KEY, OFFERED).catch(() => undefined),
  };
}
