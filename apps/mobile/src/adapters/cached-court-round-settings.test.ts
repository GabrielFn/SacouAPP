import { QueryClient } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";

import { withLeaf } from "../features/groups/model/settings-patch";
import {
  attendanceRound,
  attendanceSettings,
} from "../features/rounds/model/attendance.test.fixture";
import { queryKeys } from "../services/query/query-keys";
import { createCachedCourtRoundSettings } from "./cached-court-round-settings";

const ORIGIN = { groupId: "g1", roundId: "r1" };

function clientWithRound(individualPoints: boolean | "broken"): QueryClient {
  const client = new QueryClient();
  const resolved =
    individualPoints === "broken"
      ? { mvp: "nope" }
      : withLeaf(attendanceSettings(), "mvp.individualPoints", individualPoints);
  const round = attendanceRound();
  client.setQueryData(queryKeys.round(ORIGIN.groupId, ORIGIN.roundId), {
    ...round,
    settings: { ...round.settings, resolved },
  });
  return client;
}

describe("the settings of the round of a court session, from the cache (D10)", () => {
  test("the option of the round turns screen 31 on or off", () => {
    expect(createCachedCourtRoundSettings(clientWithRound(true)).individualPoints(ORIGIN)).toBe(
      true,
    );
    expect(createCachedCourtRoundSettings(clientWithRound(false)).individualPoints(ORIGIN)).toBe(
      false,
    );
  });

  test("a round not in the cache, or with settings that do not parse, is off", () => {
    const settings = createCachedCourtRoundSettings(clientWithRound(true));
    expect(settings.individualPoints({ groupId: "g1", roundId: "r2" })).toBe(false);
    expect(createCachedCourtRoundSettings(clientWithRound("broken")).individualPoints(ORIGIN)).toBe(
      false,
    );
  });
});
