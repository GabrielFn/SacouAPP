import { SETTINGS_CATALOG } from "@sacou/match-engine";
import { describe, expect, test } from "vitest";

import {
  CUSTOM_BLOCKS,
  customBase,
  enabledPath,
  originFromParams,
  parseCustomBlocks,
  serializeCustomBlocks,
} from "./custom-blocks";
import {
  customBlocksReducer,
  initialCustomBlocksState,
  type CustomBlocksAction,
} from "./custom-blocks.reducer";

describe("the blocks of screen 04a", () => {
  test("each block has its switch in the catalog, and money is not among them", () => {
    const paths = new Set(SETTINGS_CATALOG.fields.map((field) => field.path));
    CUSTOM_BLOCKS.forEach((block) => {
      expect(paths.has(enabledPath(block))).toBe(true);
    });
    expect(CUSTOM_BLOCKS).toEqual(["attendance", "scoring", "queue", "rotation", "draw", "mvp"]);
  });

  test("the route text keeps the order of the screen and reads back", () => {
    expect(serializeCustomBlocks(["queue", "attendance"])).toBe("attendance,queue");
    expect(serializeCustomBlocks([])).toBe("");
    expect(parseCustomBlocks("attendance,queue")).toEqual(["attendance", "queue"]);
    expect(parseCustomBlocks("")).toEqual([]);
  });

  test.each(["money", "attendance,attendance", "attendance,", "Attendance", "queue,xyz"])(
    "the text %j is refused",
    (text) => {
      expect(parseCustomBlocks(text)).toBeNull();
    },
  );

  test("from scratch has everything off and each block turns only its own switch", () => {
    const none = customBase([]);
    CUSTOM_BLOCKS.forEach((block) => {
      expect(none[block].enabled).toBe(false);
    });
    const some = customBase(["scoring", "mvp"]);
    expect(some.scoring.enabled).toBe(true);
    expect(some.mvp.enabled).toBe(true);
    expect(some.attendance.enabled).toBe(false);
    expect(some.queue.enabled).toBe(false);
  });
});

describe("the origin from the route", () => {
  test("a ready template needs no blocks and ignores them", () => {
    expect(originFromParams("pelada", undefined)).toEqual({ templateKey: "pelada", blocks: [] });
    expect(originFromParams("treino", "attendance")).toEqual({ templateKey: "treino", blocks: [] });
  });

  test("from scratch needs a readable list, empty or not", () => {
    expect(originFromParams("do-zero", "")).toEqual({ templateKey: "do-zero", blocks: [] });
    expect(originFromParams("do-zero", "queue")).toEqual({
      templateKey: "do-zero",
      blocks: ["queue"],
    });
    expect(originFromParams("do-zero", undefined)).toBeNull();
    expect(originFromParams("do-zero", "money")).toBeNull();
  });

  test("a missing or unknown template is refused", () => {
    expect(originFromParams(undefined, undefined)).toBeNull();
    expect(originFromParams("outro", "")).toBeNull();
  });
});

describe("the reducer of screen 04a", () => {
  const run = (...actions: readonly CustomBlocksAction[]) =>
    actions.reduce(customBlocksReducer, initialCustomBlocksState);

  test("everything starts off and closed", () => {
    expect(initialCustomBlocksState).toEqual({ enabled: [], expanded: null });
  });

  test("a block is turned on and off by the same action", () => {
    const on = run({ type: "block-toggled", block: "queue" });
    expect(on.enabled).toEqual(["queue"]);
    expect(customBlocksReducer(on, { type: "block-toggled", block: "queue" }).enabled).toEqual([]);
  });

  test("one block shows its text at a time, and the arrow closes it again", () => {
    const first = run({ type: "block-expanded", block: "draw" });
    expect(first.expanded).toBe("draw");
    const second = customBlocksReducer(first, { type: "block-expanded", block: "mvp" });
    expect(second.expanded).toBe("mvp");
    const closed = customBlocksReducer(second, { type: "block-expanded", block: "mvp" });
    expect(closed.expanded).toBeNull();
  });

  test("opening the text does not turn the block on", () => {
    expect(run({ type: "block-expanded", block: "scoring" }).enabled).toEqual([]);
  });
});
