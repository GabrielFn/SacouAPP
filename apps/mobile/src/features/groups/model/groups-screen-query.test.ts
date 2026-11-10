import { QueryObserver } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { createFakeSacouApi } from "../../../adapters/fake-sacou-api";
import { apiErr, apiOk } from "../../../services/api/api-result";
import { apiErrorText } from "../../../services/api/api-error-text";
import type { GroupRole, MyGroup } from "../../../services/api/sacou-api";
import { createSacouQueryClient } from "../../../services/query/query-client";
import { myGroupsQuery } from "../queries/group-queries";
import { groupCardModel, groupsSummaryText } from "./groups-list.selectors";
import { groupsViewState, type GroupsViewState } from "./groups-view-state";

function group(index: number, name: string, role: GroupRole): MyGroup {
  return {
    groupId: `00000000-0000-4000-8000-00000000000${String(index)}`,
    name,
    role,
    memberType: "regular",
  };
}

const CANVAS_GROUPS = [
  group(1, "Racha de terça", "admin"),
  group(2, "Vôlei de quinta", "player"),
  group(3, "Areia de sábado", "player"),
  group(4, "Pelada do Sesc", "player"),
];

async function viewState(fake: ReturnType<typeof createFakeSacouApi>): Promise<GroupsViewState> {
  const client = createSacouQueryClient();
  const observer = new QueryObserver(client, { ...myGroupsQuery(fake.api), retry: false });
  await observer.refetch();
  const result = observer.getCurrentResult();
  return groupsViewState(result);
}

describe("the groups screens over the fake API", () => {
  it("turns the four groups of the canvas into four cards in the order of the API", async () => {
    const fake = createFakeSacouApi();
    fake.respond("listMyGroups", apiOk(CANVAS_GROUPS));
    const state = await viewState(fake);
    expect(state.kind).toBe("list");
    if (state.kind !== "list") return;
    expect(state.groups.map(groupCardModel).map((card) => card.name)).toEqual([
      "Racha de terça",
      "Vôlei de quinta",
      "Areia de sábado",
      "Pelada do Sesc",
    ]);
    expect(groupsSummaryText(state.groups)).toBe("4 grupos. Você organiza um, joga nos outros.");
  });

  it("reads an expired session as the error with the session text", async () => {
    const fake = createFakeSacouApi();
    fake.respond("listMyGroups", apiErr({ kind: "session-expired" }));
    const state = await viewState(fake);
    expect(state.kind).toBe("error");
    if (state.kind !== "error") return;
    expect(apiErrorText(state.error)).toBe("Sua sessão acabou. Entre de novo.");
  });

  it("reads no group as the empty state", async () => {
    const fake = createFakeSacouApi();
    fake.respond("listMyGroups", apiOk([]));
    expect((await viewState(fake)).kind).toBe("empty");
  });
});
