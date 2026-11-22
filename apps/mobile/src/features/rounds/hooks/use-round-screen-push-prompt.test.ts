import { beforeEach, describe, expect, test, vi } from "vitest";

import type { AttendanceResponse } from "../../../services/api/sacou-api";
import { useRoundScreen } from "./use-round-screen";

const world = vi.hoisted(() => ({
  offers: 0,
  succeeds: true,
  pending: false,
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useReducer: (_reducer: unknown, initial: unknown) => [initial, () => undefined],
}));
vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({
    isPending: world.pending,
    error: null,
    mutate: (_input: unknown, options?: { onSuccess?: () => void }) => {
      if (world.succeeds) options?.onSuccess?.();
    },
  }),
  useQueryClient: () => ({}),
}));
vi.mock("../../../services/services-context", () => ({
  useServices: () => ({ sacouApi: {}, clipboard: { setText: () => Promise.resolve() } }),
}));
vi.mock("../../groups/queries/use-group-queries", () => ({
  useGroup: () => ({ data: undefined }),
  useGroupMembers: () => ({ data: undefined }),
}));
vi.mock("../../notifications/hooks/push-prompt-context", () => ({
  useOfferPushPrompt: () => () => {
    world.offers += 1;
  },
}));
vi.mock("../queries/use-round-queries", () => ({ useRound: () => ({ data: undefined }) }));
vi.mock("../queries/round-mutations", () => ({
  respondAttendanceMutation: () => ({}),
  setMemberAttendanceMutation: () => ({}),
}));

function answer(response: AttendanceResponse): void {
  useRoundScreen("g", "r").respond(response);
}

beforeEach(() => {
  world.offers = 0;
  world.succeeds = true;
  world.pending = false;
});

describe("R98 item 9: a VOU that went through offers the notifications", () => {
  test("VOU accepted by the server: the offer starts", () => {
    answer("going");
    expect(world.offers).toBe(1);
  });

  test("not going, a refused VOU or one already on the way: no offer", () => {
    answer("notGoing");
    world.succeeds = false;
    answer("going");
    world.succeeds = true;
    world.pending = true;
    answer("going");
    expect(world.offers).toBe(0);
  });
});
