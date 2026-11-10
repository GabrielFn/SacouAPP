import { describe, expect, it } from "vitest";

import type { GroupRole, MyGroup } from "../../../services/api/sacou-api";
import { groupCardActions, groupCardModel, groupsSummaryText, organizes, roleLabel } from "./groups-list.selectors";

function groups(...roles: readonly GroupRole[]): readonly MyGroup[] {
  return roles.map((role, index) => ({
    groupId: `00000000-0000-4000-8000-00000000000${String(index)}`,
    name: `Grupo ${String(index)}`,
    role,
    memberType: "regular",
  }));
}

describe("groupsSummaryText", () => {
  it.each([
    [["admin"], "1 grupo. Você organiza."],
    [["player"], "1 grupo. Você joga nele."],
    [["admin", "coAdmin", "admin"], "3 grupos. Você organiza todos."],
    [["player", "scorekeeper", "player"], "3 grupos. Você joga em todos."],
    [["admin", "player"], "2 grupos. Você organiza um, joga no outro."],
    [["admin", "player", "player", "scorekeeper"], "4 grupos. Você organiza um, joga nos outros."],
    [["admin", "coAdmin", "player", "player", "player"], "5 grupos. Você organiza 2, joga em 3."],
  ] as const)("%j reads %s", (roles, expected) => {
    expect(groupsSummaryText(groups(...roles))).toBe(expected);
  });

  it("has no text without a group", () => {
    expect(groupsSummaryText([])).toBeNull();
  });
});

describe("roles", () => {
  it("names the four roles", () => {
    expect(
      (["admin", "coAdmin", "scorekeeper", "player"] as const).map(roleLabel),
    ).toEqual(["Admin", "Co-admin", "Placar", "Jogador"]);
  });
  it("only admin and co-admin organize", () => {
    expect((["admin", "coAdmin", "scorekeeper", "player"] as const).map(organizes)).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });
});

describe("groupCardActions", () => {
  it("shows nothing while the screens are pending", () => {
    expect(groupCardActions("admin", ["members", "settings"])).toEqual([]);
  });
  it("shows members and settings to who organizes once they exist", () => {
    expect(groupCardActions("admin", [])).toEqual(["members", "settings"]);
    expect(groupCardActions("coAdmin", [])).toEqual(["members", "settings"]);
    expect(groupCardActions("admin", ["settings"])).toEqual(["members"]);
  });
  it("never shows them to scorekeeper or player", () => {
    expect(groupCardActions("scorekeeper", [])).toEqual([]);
    expect(groupCardActions("player", [])).toEqual([]);
  });
});

describe("groupCardModel", () => {
  it("keeps the order and the data of the API", () => {
    const models = groups("admin", "player").map(groupCardModel);
    expect(models.map((model) => model.name)).toEqual(["Grupo 0", "Grupo 1"]);
    expect(models.map((model) => model.roleLabel)).toEqual(["Admin", "Jogador"]);
    expect(models[0]?.nextRoundText).toBe("Nenhuma rodada marcada");
  });
});
