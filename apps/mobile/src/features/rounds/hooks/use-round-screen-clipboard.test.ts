import { describe, expect, test, vi } from "vitest";

import { attendanceRound, memberOf } from "../model/attendance.test.fixture";

import { useRoundScreen } from "./use-round-screen";

const setText = vi.hoisted(() => vi.fn<(text: string) => Promise<void>>());
const dispatch = vi.hoisted(() => vi.fn());
const share = vi.hoisted(() => vi.fn<(text: string) => Promise<void>>());

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useReducer: (_reducer: unknown, initial: unknown) => [initial, dispatch],
}));
vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ isPending: false, error: null, mutate: () => undefined }),
  useQueryClient: () => ({}),
}));
vi.mock("../../../services/services-context", () => ({
  useServices: () => ({ sacouApi: {}, clipboard: { setText }, shareSheet: { share } }),
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

const URL = "https://sacou.example/r/K7fQ2xK7fQ2xK7fQ2xK7fQ";
/** Far in the future, so the round is open whatever day the tests run. */
const openWithLink = attendanceRound({
  shareUrl: URL,
  startsAt: "2099-01-01T22:00:00Z",
  endsAt: "2099-01-02T04:00:00Z",
});

describe("the link of the round (R101 item 1)", () => {
  test("Copiar lista of an open round with the link ends in 'Confirma aqui' and says so", async () => {
    setText.mockReset().mockResolvedValue(undefined);
    dispatch.mockClear();
    useRoundScreen("g", "r").copyList({
      groupName: "Racha",
      round: openWithLink,
      members: [],
      waitlistEnabled: false,
    });
    expect(setText.mock.calls[0]?.[0]).toMatch(new RegExp(`\nConfirma aqui: ${URL}$`, "u"));
    await Promise.resolve();
    expect(dispatch).toHaveBeenCalledWith({ type: "list-and-link-copied" });
  });

  test("a round that already started copies the list without the link", () => {
    setText.mockReset().mockResolvedValue(undefined);
    useRoundScreen("g", "r").copyList({
      groupName: "Racha",
      round: attendanceRound({ shareUrl: URL }),
      members: [],
      waitlistEnabled: false,
    });
    expect(setText.mock.calls[0]?.[0]).not.toContain("Confirma aqui");
  });

  test("Mandar no WhatsApp opens the share sheet once, with the text and the link", () => {
    share.mockReset().mockResolvedValue(undefined);
    useRoundScreen("g", "r").shareLink("Racha", openWithLink);
    expect(share).toHaveBeenCalledTimes(1);
    expect(share.mock.calls[0]?.[0]).toContain(`Confirma aqui: ${URL}`);
  });

  test("without the link on offer, the share sheet is never opened", () => {
    share.mockReset().mockResolvedValue(undefined);
    useRoundScreen("g", "r").shareLink("Racha", attendanceRound({ shareUrl: URL }));
    useRoundScreen("g", "r").shareLink("Racha", { ...openWithLink, shareUrl: null });
    expect(share).not.toHaveBeenCalled();
  });

  test("a share sheet that refuses shows the note, which goes away later", async () => {
    vi.useFakeTimers();
    share.mockReset().mockRejectedValue(new Error("no sheet"));
    dispatch.mockClear();
    useRoundScreen("g", "r").shareLink("Racha", openWithLink);
    await vi.runAllTimersAsync();
    expect(dispatch).toHaveBeenCalledWith({ type: "share-failed" });
    expect(dispatch).toHaveBeenLastCalledWith({ type: "share-note-cleared" });
    vi.useRealTimers();
  });
});
