import { describe, expect, it } from "vitest";

import { arrangementOf } from "./draw-arrangement";
import { confirmTeamsBody } from "./confirm-teams-body";
import { G1_ANSWER, RESERVES, TEAM_A, TEAM_B } from "./draw.test.fixture";

describe("confirmTeamsBody (R100, case 15)", () => {
  it("sends the G1 teams and the queue as IDs, in order", () => {
    expect(confirmTeamsBody(arrangementOf(G1_ANSWER))).toEqual({
      teams: [[...TEAM_A], [...TEAM_B]],
      reserves: [...RESERVES],
    });
  });

  it("never carries a level, though the arrangement holds every one", () => {
    const arrangement = arrangementOf(G1_ANSWER);

    expect(arrangement.levels.size).toBeGreaterThan(0);
    expect(JSON.stringify(confirmTeamsBody(arrangement))).not.toMatch(
      /level|average|difference|seed/i,
    );
  });
});
