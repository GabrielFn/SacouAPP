import { describe, expect, test } from "vitest";

import {
  canManageInvites,
  inviteRows,
  memberRowModel,
  membersHeader,
  membersOfTab,
  membersTabs,
  shortDay,
  tabLabel,
} from "./members.selectors";
import { member } from "./members.test.fixture";

const NOON = "T12:00:00Z";

describe("members of a tab", () => {
  const list = [
    member("p1", "player", { joinedAt: `2026-10-01${NOON}`, memberType: "regular" }),
    member("s", "scorekeeper", { memberType: "regular" }),
    member("p0", "player", { joinedAt: `2026-09-01${NOON}`, memberType: "regular" }),
    member("me", "player", { isMe: true, memberType: "regular" }),
    member("a", "admin", { memberType: "regular" }),
    member("c", "coAdmin", { memberType: "regular" }),
    member("d", "admin"),
  ];

  test("you first, then Admin, Co-admin, Placar, Jogador, and who joined first", () => {
    expect(membersOfTab(list, "regular").map((m) => m.memberId)).toEqual([
      "me",
      "a",
      "c",
      "s",
      "p0",
      "p1",
    ]);
    expect(membersOfTab(list, "dropIn").map((m) => m.memberId)).toEqual(["d"]);
    expect(membersOfTab(list, "invites")).toEqual([]);
  });

  test("the tab labels count each type", () => {
    expect(tabLabel("regular", list)).toBe("Mensalistas (6)");
    expect(tabLabel("dropIn", list)).toBe("Avulsos (1)");
    expect(tabLabel("invites", list)).toBe("Convites");
  });

  test("only who manages invites gets the tab", () => {
    expect(membersTabs("admin")).toEqual(["regular", "dropIn", "invites"]);
    expect(membersTabs("coAdmin")).toContain("invites");
    expect(membersTabs("scorekeeper")).toEqual(["regular", "dropIn"]);
    expect(membersTabs("player")).toEqual(["regular", "dropIn"]);
    expect(canManageInvites("player")).toBe(false);
  });
});

describe("a row before the names", () => {
  test("your own row says Você and Mensalista · você", () => {
    const model = memberRowModel(member("me", "admin", { isMe: true, memberType: "regular" }));
    expect(model).toMatchObject({
      title: "Você",
      badgeLabel: "Admin",
      badgeLook: "admin",
      detail: "Mensalista · você",
      dashedAvatar: false,
      optionsLabel: "Suas opções",
    });
  });

  test("another row says since when, in the short Portuguese month", () => {
    const model = memberRowModel(member("p", "scorekeeper", { joinedAt: `2026-10-12${NOON}` }));
    expect(model.title).toBe("Membro desde 12 out");
    expect(model.detail).toBe("Avulso");
    expect(model.badgeLabel).toBe("Placar");
    expect(model.optionsLabel).toBe("Opções de membro desde 12 out");
  });

  test("a guest without an account has the yellow badge and the dashed avatar", () => {
    const model = memberRowModel(member("g", "player", { hasAccount: false }));
    expect(model).toMatchObject({ badgeLabel: "Sem conta", badgeLook: "noAccount" });
    expect(model.dashedAvatar).toBe(true);
  });

  test("the header names the group and the role", () => {
    expect(membersHeader("Racha de terça", "admin")).toBe("Racha de terça · você é admin");
    expect(membersHeader("Racha", "coAdmin")).toBe("Racha · você é co-admin");
  });

  test("every month has its short name", () => {
    const months = Array.from({ length: 12 }, (_, index) =>
      shortDay(`2026-${String(index + 1).padStart(2, "0")}-15${NOON}`),
    );
    expect(months.join(",")).toBe(
      "15 jan,15 fev,15 mar,15 abr,15 mai,15 jun,15 jul,15 ago,15 set,15 out,15 nov,15 dez",
    );
  });
});

describe("the invites tab", () => {
  test("the newest first, with the uses and no token", () => {
    const rows = inviteRows([
      {
        inviteId: "old",
        createdAt: `2026-11-01${NOON}`,
        createdBy: "a",
        expiresAt: null,
        useCount: 1,
      },
      {
        inviteId: "new",
        createdAt: `2026-11-10${NOON}`,
        createdBy: "a",
        expiresAt: null,
        useCount: 3,
      },
    ]);
    expect(rows).toEqual([
      {
        inviteId: "new",
        text: "Criado em 10 nov · 3 entradas",
        revokeLabel: "Revogar o convite criado em 10 nov",
      },
      {
        inviteId: "old",
        text: "Criado em 1 nov · 1 entrada",
        revokeLabel: "Revogar o convite criado em 1 nov",
      },
    ]);
  });
});

describe("a row with the names (E3.17, Membros.dc.html)", () => {
  test("João: Ponteiro · mensalista · você", () => {
    const joao = member("j", "admin", {
      isMe: true,
      memberType: "regular",
      nickname: "João",
      primaryPosition: "outsideHitter",
    });
    expect(memberRowModel(joao)).toMatchObject({
      title: "João",
      initials: "JO",
      detail: "Ponteiro · mensalista · você",
      optionsLabel: "Opções de João",
    });
  });

  test("Bia: the other positions in lower case, in the order of the API", () => {
    const bia = member("b", "player", {
      memberType: "regular",
      nickname: "Bia",
      primaryPosition: "outsideHitter",
      otherPositions: ["libero"],
    });
    expect(memberRowModel(bia).detail).toBe("Ponteiro · líbero · mensalista");
  });

  test("Léo, a guest: Sem conta and entrou pelo WhatsApp", () => {
    const leo = member("l", "player", {
      hasAccount: false,
      nickname: "Léo",
      primaryPosition: "outsideHitter",
    });
    const model = memberRowModel(leo);
    expect([model.title, model.badgeLabel, model.detail].join(" · ")).toBe(
      "Léo · Sem conta · Ponteiro · avulso · entrou pelo WhatsApp",
    );
  });

  test("any position reads Qualquer uma; no profile keeps the neutral avatar", () => {
    const any = member("a", "player", { nickname: "Ana", primaryPosition: "any" });
    expect(memberRowModel(any).detail).toBe("Qualquer uma · avulso");
    expect(memberRowModel(member("n", "player")).initials).toBeNull();
  });

  test.each([
    ["élan", "ÉL"],
    ["  42 bola", "42"],
    ["🏐 Rafa", "RA"],
    ["🏐🏐", null],
  ])("the initials of %s are %s", (nickname, initials) => {
    expect(memberRowModel(member("x", "player", { nickname })).initials).toBe(initials);
  });
});
