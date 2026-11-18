import { getRecentPoints } from "@sacou/match-engine";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";

import { createCachedCourtRoster } from "../../../adapters/cached-court-roster";
import { memberOf } from "../../rounds/model/attendance.test.fixture";
import { createCacheSession } from "../../../services/query/cache-persister";
import { queryKeys } from "../../../services/query/query-keys";
import { timelineRows } from "../corrections/corrections-selectors";
import { SAMPLE_ORANGE_LINEUP } from "../dev/sample-match.data";
import { score, startScenario } from "../model/screen-scenarios.test.fixture";
import { attributionSheet } from "./attribution-selectors";
import { attributionReducer, CLOSED_ATTRIBUTION } from "./attribution.reducer";

const [PEDRO] = SAMPLE_ORANGE_LINEUP;
const NEUTRAL_NAME = "Jogador";

describe("screen 31 and 24 after sign-out (E4.10 part 3, privacy)", () => {
  test("names of the previous account are gone once the cache session is cleared", async () => {
    const client = new QueryClient();
    client.setQueryData(queryKeys.members("g1"), [memberOf(PEDRO ?? "", "Pedro Secreto")]);
    const roster = createCachedCourtRoster(client);
    const scenario = await startScenario();
    await score(scenario, "a");
    const pointId = getRecentPoints(scenario.timeline())[0]?.eventId ?? "";
    await scenario.controller.dispatch({
      type: "attribute-point",
      pointEventId: pointId,
      authorship: { kind: "attack", author: PEDRO ?? null },
    });
    const asking = [
      { type: "opened", pointEventIds: [pointId] },
      { type: "kind-chosen", kind: "attack" },
    ] as const;
    const state = asking.reduce(attributionReducer, CLOSED_ATTRIBUTION);

    const before = JSON.stringify([
      attributionSheet(scenario.timeline(), roster, state),
      timelineRows(scenario.timeline(), roster, null, true),
    ]);
    expect(before).toContain("Pedro Secreto");

    let persisted = true;
    await createCacheSession(client, {
      persistClient: () => Promise.resolve(),
      restoreClient: () => Promise.resolve(undefined),
      removeClient: () => {
        persisted = false;
        return Promise.resolve();
      },
    }).clearSession();

    const after = JSON.stringify([
      attributionSheet(scenario.timeline(), roster, state),
      timelineRows(scenario.timeline(), roster, null, true),
    ]);
    expect(persisted).toBe(false);
    expect(after).not.toContain("Pedro Secreto");
    expect(after).toContain(NEUTRAL_NAME);
  });
});
