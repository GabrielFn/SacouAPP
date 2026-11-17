import { withLeaf } from "../../groups/model/settings-patch";
import { describe, expect, test } from "vitest";

import { defaultLineup } from "./default-lineup";
import { buildMatchStart } from "./match-start";
import { g1Input, preGameSettings } from "./pre-game.test.fixture";

describe("tester edges of the pre-game", () => {
  test("a single-set match has no tie-break, even with the tie-break on in the round", () => {
    const settings = preGameSettings((s) => withLeaf(s, "scoring.tieBreakEnabled", true));
    const payload = buildMatchStart(g1Input({ bestOf: 1 }, settings), "m1");
    expect(payload.ok && payload.value.scoring.tieBreakPoints).toBeNull();
  });

  test.each(["5x1", "6x2", "4x2", "livre"] as const)(
    "a repeated member is an error in %s, never one person in two seats",
    (system) => {
      const result = defaultLineup(["a", "b", "c", "d", "e", "a"], system, () => null);
      expect(result).toEqual({ ok: false, error: "duplicate-member" });
    },
  );
});
