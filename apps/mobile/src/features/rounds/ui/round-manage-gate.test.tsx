import { isValidElement, type ReactElement } from "react";
import { describe, expect, test, vi } from "vitest";

import { groupsHref } from "../../groups/navigation";
import { roundHref } from "../navigation";
import { AddPlayerScreen } from "./AddPlayerScreen";
import { CreateRoundScreen, EditRoundScreen } from "./CreateRoundScreen";

const gate = vi.hoisted(() => ({ role: "player" }));
const REDIRECT = vi.hoisted(() => function Redirect() {});

vi.mock("expo-router", () => ({
  Redirect: REDIRECT,
  useRouter: () => ({ replace: () => undefined }),
}));
vi.mock("react-native", () => ({ View: "View", Pressable: "Pressable", Text: "Text" }));
vi.mock("../../../theme/theme-context", () => ({ useTheme: () => ({ tokens: {} }) }));
vi.mock("../../../ui/Button", () => ({ Button: () => null }));
vi.mock("../../../ui/ErrorStrip", () => ({ ErrorStrip: () => null }));
vi.mock("../../../ui/BackBar", () => ({ BackBar: () => null }));
vi.mock("../../../ui/Screen", () => ({ Screen: () => null }));
vi.mock("../../../ui/Text", () => ({ Text: () => null }));
vi.mock("../../../ui/TextField", () => ({ TextField: () => null }));
vi.mock("../../../ui/BottomSheet", () => ({ BottomSheet: () => null }));
vi.mock("../../../ui/LoadingState", () => ({ LoadingState: () => null }));
vi.mock("./AddableList", () => ({ AddableList: () => null, AddFeedback: () => null }));
vi.mock("./DatePickerSheet", () => ({ DatePickerSheet: () => null }));
vi.mock("./RoundFormParts", () => ({
  FormLoading: () => null,
  PickerField: () => null,
  RepeatRow: () => null,
  TimeSheet: () => null,
}));
vi.mock("./GuestSheet", () => ({ GuestBlock: () => null, GuestSheet: () => null }));
vi.mock("./PersonalizeSection", () => ({ PersonalizeSection: () => null }));
vi.mock("./RoundChips", () => ({ RoundChips: () => null }));
vi.mock("./RoundHeading", () => ({ RoundLoading: () => null }));
vi.mock("../hooks/use-create-round", () => ({ useCreateRound: () => ({}) }));
vi.mock("../hooks/use-edit-round", () => ({ useEditRound: () => ({}) }));
vi.mock("../hooks/use-add-player", () => ({
  useAddPlayer: () => ({
    group: { data: { name: "Racha", role: gate.role } },
    round: { data: undefined },
    members: { data: undefined },
  }),
}));
vi.mock("../../groups/queries/use-group-queries", () => ({
  useGroup: () => ({ data: { name: "Racha", role: gate.role } }),
  useGroupSettings: () => ({ data: undefined }),
}));
vi.mock("../queries/use-round-queries", () => ({
  useRound: () => ({ data: undefined }),
  useRounds: () => ({ data: undefined }),
}));

function redirectOf(element: unknown): unknown {
  if (!isValidElement(element) || element.type !== REDIRECT) return null;
  return (element as ReactElement<{ href: string }>).props.href;
}

describe("only who manages rounds opens 21a, new round and Editar rodada", () => {
  test.each(["player"])("the role %s goes back to the round from screen 21", (role) => {
    gate.role = role;
    expect(redirectOf(AddPlayerScreen({ groupId: "g", roundId: "r" }))).toEqual(
      roundHref("g", "r"),
    );
  });

  test.each(["player"])("the role %s goes back to the round from Editar rodada", (role) => {
    gate.role = role;
    expect(redirectOf(EditRoundScreen({ groupId: "g", roundId: "r" }))).toEqual(
      roundHref("g", "r"),
    );
  });

  test("the player does not open the new round form either", () => {
    gate.role = "player";
    expect(redirectOf(CreateRoundScreen({ groupId: "g" }))).toEqual(groupsHref);
  });

  test.each(["admin", "coAdmin"])("the role %s is not redirected", (role) => {
    gate.role = role;
    expect(redirectOf(AddPlayerScreen({ groupId: "g", roundId: "r" }))).toBeNull();
    expect(redirectOf(EditRoundScreen({ groupId: "g", roundId: "r" }))).toBeNull();
  });
});
