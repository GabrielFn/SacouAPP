import { describe, expect, test } from "vitest";

import { createMemoryKeyValueStore } from "./memory-key-value-store";
import { createStoredNextMatchDrafts, nextMatchDraftKey } from "./stored-next-match-drafts";

const MATCH_ID = "f0000000-0000-4000-8000-000000000001";
const DRAFT = { drawOrder: { a: ["m1", "m2"], b: ["m3"] }, chosen: { a: [], b: ["m3"] } };

describe("the draft of the next match on the phone", () => {
  test("saved under its match, read back the same, and cleared when the next match starts", async () => {
    const store = createMemoryKeyValueStore();
    const drafts = createStoredNextMatchDrafts(store);
    await drafts.save(MATCH_ID, DRAFT);
    expect([...store.entries().keys()]).toEqual([`court:next-match:${MATCH_ID}`]);
    expect(await drafts.load(MATCH_ID)).toEqual(DRAFT);
    await drafts.clear(MATCH_ID);
    expect(await drafts.load(MATCH_ID)).toBeNull();
  });

  test("a row that does not read as a draft is no draft", async () => {
    const store = createMemoryKeyValueStore();
    const drafts = createStoredNextMatchDrafts(store);
    for (const raw of [
      "{",
      "null",
      '{"drawOrder":null}',
      '{"drawOrder":1,"chosen":{"a":[],"b":[]}}',
    ]) {
      await store.setItem(nextMatchDraftKey(MATCH_ID), raw);
      expect(await drafts.load(MATCH_ID)).toBeNull();
    }
  });

  test("a store that fails to read gives no draft", async () => {
    const drafts = createStoredNextMatchDrafts({
      getItem: () => Promise.reject(new Error("disk")),
      setItem: () => Promise.resolve(),
      removeItem: () => Promise.resolve(),
    });
    expect(await drafts.load(MATCH_ID)).toBeNull();
  });
});
