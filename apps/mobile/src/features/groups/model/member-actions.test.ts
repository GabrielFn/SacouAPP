import { describe, expect, test } from "vitest";

import type { GroupRole, Member } from "../../../services/api/sacou-api";
import { losesInvites, memberActions, type ChipState } from "./member-actions";
import { member } from "./members.test.fixture";

type Chips = Readonly<Record<GroupRole, ChipState>>;

function chipsOf(me: Member, target: Member, members: readonly Member[]): Chips | null {
  const sheet = memberActions(me, target, members);
  if (sheet?.roles == null) return null;
  return Object.fromEntries(sheet.roles.map((chip) => [chip.role, chip.state])) as Chips;
}

const admin = member("a", "admin", { isMe: true });
const otherAdmin = member("a2", "admin");
const coAdmin = member("c", "coAdmin");
const scorekeeper = member("s", "scorekeeper");
const player = member("p", "player");
const guest = member("g", "player", { hasAccount: false });

describe("memberActions, the table of answer 16 with chips off instead of missing", () => {
  test("an admin gives any role to someone else", () => {
    const all = [admin, coAdmin, player];
    expect(chipsOf(admin, player, all)).toEqual({
      admin: "enabled",
      coAdmin: "enabled",
      scorekeeper: "enabled",
      player: "current",
    });
    expect(chipsOf(admin, coAdmin, all)?.coAdmin).toBe("current");
  });

  test("a co-admin over a player: Admin and Co-admin off, Placar and Jogador on", () => {
    const me = { ...coAdmin, isMe: true };
    expect(chipsOf(me, player, [admin, me, player])).toEqual({
      admin: "disabled",
      coAdmin: "disabled",
      scorekeeper: "enabled",
      player: "current",
    });
  });

  test("a co-admin over an admin or another co-admin: every chip off", () => {
    const me = { ...coAdmin, isMe: true };
    const other = member("c2", "coAdmin");
    for (const target of [{ ...admin, isMe: false }, other]) {
      const chips = chipsOf(me, target, [me, target]);
      expect(Object.values(chips ?? {}).filter((state) => state === "enabled")).toEqual([]);
    }
  });

  test("a guest without an account stays Jogador and cannot be Mensalista", () => {
    const sheet = memberActions(admin, guest, [admin, guest]);
    expect(chipsOf(admin, guest, [admin, guest])).toEqual({
      admin: "disabled",
      coAdmin: "disabled",
      scorekeeper: "disabled",
      player: "current",
    });
    expect(sheet?.type).toEqual({ regularBlocked: true });
  });

  test("another person's row never offers Remover until the names (question 30)", () => {
    expect(memberActions(admin, player, [admin, player])?.canLeave).toBe(false);
  });

  test("Placar and Jogador have no options on someone else's row", () => {
    for (const role of ["scorekeeper", "player"] as const) {
      const me = member("me", role, { isMe: true });
      expect(memberActions(me, admin, [me, admin])).toBeNull();
    }
  });

  test("the own row of Placar or Jogador offers only Sair", () => {
    const me = { ...scorekeeper, isMe: true };
    expect(memberActions(me, me, [admin, me])).toEqual({
      target: me,
      roles: null,
      type: null,
      canLeave: true,
      lastAdmin: false,
    });
  });

  test("the last admin cannot leave nor demote itself", () => {
    const sheet = memberActions(admin, admin, [admin, coAdmin]);
    expect(sheet?.lastAdmin).toBe(true);
    expect(sheet?.canLeave).toBe(true);
    expect(sheet?.roles?.map((chip) => chip.state)).toEqual([
      "current",
      "disabled",
      "disabled",
      "disabled",
    ]);
  });

  test("an admin with another admin may demote itself", () => {
    const sheet = memberActions(admin, admin, [admin, otherAdmin]);
    expect(sheet?.lastAdmin).toBe(false);
    expect(sheet?.roles?.map((chip) => chip.state)).toEqual([
      "current",
      "enabled",
      "enabled",
      "enabled",
    ]);
  });

  test("a co-admin never demotes itself, but changes its own type", () => {
    const me = { ...coAdmin, isMe: true };
    const sheet = memberActions(me, me, [admin, me]);
    expect(sheet?.roles?.filter((chip) => chip.state === "enabled")).toEqual([]);
    expect(sheet?.type).toEqual({ regularBlocked: false });
    expect(sheet?.canLeave).toBe(true);
  });
});

describe("losesInvites", () => {
  test("only Placar and Jogador lose the links they made", () => {
    expect((["admin", "coAdmin", "scorekeeper", "player"] as const).map(losesInvites)).toEqual([
      false,
      false,
      true,
      true,
    ]);
  });
});
