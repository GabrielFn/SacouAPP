import { beforeEach, describe, expect, test, vi } from "vitest";

import { useGroupRounds } from "./use-group-rounds";

const cache = vi.hoisted<{ rounds: object; groups: { data: unknown } }>(() => ({
  rounds: { data: [], isError: false, refetch: vi.fn(), dataUpdatedAt: 0 },
  groups: { data: undefined },
}));

vi.mock("../../../services/api/use-online", () => ({ useOnline: () => true }));
vi.mock("../../../services/api/wall-clock", () => ({ wallClockNow: () => 0 }));
vi.mock("../queries/use-round-queries", () => ({ useRounds: () => cache.rounds }));
vi.mock("../../groups/queries/use-group-queries", () => ({ useMyGroups: () => cache.groups }));

const withRole = (role: string) => ({ data: [{ groupId: "g1", name: "Racha", role }] });
const useCanCreate = () => {
  const model = useGroupRounds("g1");
  return model.kind === "list" ? model.canCreate : "not a list";
};

describe("useGroupRounds: who sees Nova rodada", () => {
  beforeEach(() => {
    cache.groups = { data: undefined };
  });

  test.each([
    ["admin", true],
    ["coAdmin", true],
    ["player", false],
  ])("role %s gives canCreate %s", (role, expected) => {
    cache.groups = withRole(role);
    expect(useCanCreate()).toBe(expected);
  });

  test("an unknown group (still loading) gives false", () => {
    expect(useCanCreate()).toBe(false);
  });

  test("a group the user is not in gives false", () => {
    cache.groups = { data: [{ groupId: "other", name: "X", role: "admin" }] };
    expect(useCanCreate()).toBe(false);
  });
});
