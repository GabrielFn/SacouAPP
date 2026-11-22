import { describe, expect, test, vi } from "vitest";

import { attendanceRound, memberOf } from "../model/attendance.test.fixture";

import { useRoundScreen } from "./use-round-screen";

const setText = vi.hoisted(() => vi.fn<(text: string) => Promise<void>>());
const dispatch = vi.hoisted(() => vi.fn());

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useReducer: (_reducer: unknown, initial: unknown) => [initial, dispatch],
}));
vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ isPending: false, error: null, mutate: () => undefined }),
  useQueryClient: () => ({}),
}));
vi.mock("../../../services/services-context", () => ({
  useServices: () => ({ sacouApi: {}, clipboard: { setText } }),
}));
vi.mock("../../groups/queries/use-group-queries", () => ({
  useGroup: () => ({ data: undefined }),
  useGroupMembers: () => ({ data: undefined }),
}));
vi.mock("../../notifications/hooks/push-prompt-context", () => ({
  useOfferPushPrompt: () => () => undefined,
}));
vi.mock("../queries/use-round-queries", () => ({ useRound: () => ({ data: undefined }) }));
vi.mock("../queries/round-mutations", () => ({
  respondAttendanceMutation: () => ({}),
  setMemberAttendanceMutation: () => ({}),
}));

describe("the clipboard only gets the list on the tap of Copiar lista", () => {
  test("rendering the model, answering and removing never touch the clipboard", () => {
    setText.mockReset();
    const model = useRoundScreen("g", "r");
    model.respond("going");
    model.removeMember("m-x");
    model.dispatch({ type: "confirmed-opened" });
    expect(setText).toHaveBeenCalledTimes(0);
  });

  test("the tap puts exactly one text there, then marks it copied", async () => {
    setText.mockReset().mockResolvedValue(undefined);
    dispatch.mockClear();
    const model = useRoundScreen("g", "r");
    model.copyList({
      groupName: "Racha",
      round: attendanceRound(),
      members: [memberOf("m-ana", "Ana")],
      waitlistEnabled: true,
    });
    expect(setText).toHaveBeenCalledTimes(1);
    expect(setText.mock.calls[0]?.[0]).toContain("Racha");
    await Promise.resolve();
    expect(dispatch).toHaveBeenCalledWith({ type: "list-copied" });
  });

  test("a clipboard that refuses shows the failure, and the note goes away later", async () => {
    vi.useFakeTimers();
    setText.mockReset().mockRejectedValue(new Error("denied"));
    dispatch.mockClear();
    useRoundScreen("g", "r").copyList({
      groupName: "Racha",
      round: attendanceRound(),
      members: [],
      waitlistEnabled: false,
    });
    await vi.runAllTimersAsync();
    expect(dispatch).toHaveBeenCalledWith({ type: "copy-failed" });
    expect(dispatch).toHaveBeenLastCalledWith({ type: "copy-note-cleared" });
    vi.useRealTimers();
  });
});
