import { describe, expect, it } from "vitest";

import { ApiFailure } from "../../../services/api/api-error";
import type { MyGroup } from "../../../services/api/sacou-api";
import { groupsViewState, type GroupsQuerySnapshot } from "./groups-view-state";

const GROUP: MyGroup = {
  groupId: "00000000-0000-4000-8000-000000000001",
  name: "Racha",
  role: "admin",
  memberType: "regular",
};

function snapshot(patch: Partial<GroupsQuerySnapshot>): GroupsQuerySnapshot {
  return { status: "pending", fetchStatus: "fetching", data: undefined, error: null, ...patch };
}

describe("groupsViewState", () => {
  it("loads while the first answer is on the way", () => {
    expect(groupsViewState(snapshot({}))).toEqual({ kind: "loading" });
  });
  it("is offline-empty when paused without data", () => {
    expect(groupsViewState(snapshot({ fetchStatus: "paused" }))).toEqual({ kind: "offline-empty" });
  });
  it("carries the ApiError of a failure without data", () => {
    const error = new ApiFailure({ kind: "session-expired" });
    expect(groupsViewState(snapshot({ status: "error", fetchStatus: "idle", error }))).toEqual({
      kind: "error",
      error: { kind: "session-expired" },
    });
  });
  it("never shows the raw error that is not an ApiFailure", () => {
    const state = groupsViewState(
      snapshot({ status: "error", fetchStatus: "idle", error: new Error("boom") }),
    );
    expect(state).toEqual({ kind: "error", error: { kind: "unexpected", status: 0 } });
  });
  it("keeps the list when a new fetch failed", () => {
    const state = groupsViewState(
      snapshot({ status: "error", fetchStatus: "idle", data: [GROUP], error: new Error("x") }),
    );
    expect(state).toEqual({ kind: "list", groups: [GROUP] });
  });
  it("is empty with an empty list and a list with items", () => {
    expect(groupsViewState(snapshot({ status: "success", fetchStatus: "idle", data: [] }))).toEqual({
      kind: "empty",
    });
    expect(
      groupsViewState(snapshot({ status: "success", fetchStatus: "idle", data: [GROUP] })),
    ).toEqual({ kind: "list", groups: [GROUP] });
  });
});
