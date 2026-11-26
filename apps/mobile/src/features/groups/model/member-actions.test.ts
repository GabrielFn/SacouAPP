import { describe, expect, test } from "vitest";

import type { GroupRole, Member } from "../../../services/api/sacou-api";
import { canManageLevels, losesInvites, memberActions, type ChipState } from "./member-actions";
import { member } from "./members.test.fixture";

type Chips = Readonly<Record<GroupRole, ChipState>>;

function chipsOf(me: Member, target: Member, members: readonly Member[]): Chips | null {
  const sheet = memberActions(me, target, members);
  if (sheet.roles == null) return null;
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
    expect(sheet.type).toEqual({ regularBlocked: true });
  });

  test("another person's row offers Remover, never Sair (question 30)", () => {
    const sheet = memberActions(admin, player, [admin, player]);
    expect(sheet).toMatchObject({ canLeave: false, canRemove: true, showsLevel: true });
  });

  test("an admin removes anyone; a co-admin only Placar and Jogador (RemoveAdmin)", () => {
    const all = [admin, otherAdmin, coAdmin, scorekeeper, player, guest];
    expect(memberActions(admin, otherAdmin, all).canRemove).toBe(true);
    expect(memberActions(admin, coAdmin, all).canRemove).toBe(true);
    const me = member("c2", "coAdmin", { isMe: true });
    const withMe = [...all, me];
    expect(memberActions(me, otherAdmin, withMe).canRemove).toBe(false);
    expect(memberActions(me, coAdmin, withMe).canRemove).toBe(false);
    expect(memberActions(me, scorekeeper, withMe).canRemove).toBe(true);
    expect(memberActions(me, guest, withMe).canRemove).toBe(true);
  });

  test("the own row never offers Remover; only admins see the level, their own included", () => {
    expect(memberActions(admin, admin, [admin, otherAdmin])).toMatchObject({
      canRemove: false,
      showsLevel: true,
    });
    for (const role of ["scorekeeper", "player"] as const) {
      const me = member("me", role, { isMe: true });
      expect(memberActions(me, me, [admin, me])).toMatchObject({
        canRemove: false,
        showsLevel: false,
      });
      expect(canManageLevels(role)).toBe(false);
    }
    expect(canManageLevels("admin") && canManageLevels("coAdmin")).toBe(true);
  });

  test("Placar and Jogador get only Denunciar on someone else's row (E6.6)", () => {
    for (const role of ["scorekeeper", "player"] as const) {
      const me = member("me", role, { isMe: true });
      for (const target of [{ ...admin, isMe: false }, player, guest]) {
        expect(memberActions(me, target, [me, admin, player, guest])).toEqual({
          target,
          roles: null,
          type: null,
          canLeave: false,
          canRemove: false,
          canReport: true,
          showsLevel: false,
          lastAdmin: false,
        });
      }
    }
  });

  test("admins get Denunciar on every other row, below their own actions (E6.6)", () => {
    const all = [admin, otherAdmin, coAdmin, scorekeeper, player, guest];
    for (const target of [otherAdmin, coAdmin, scorekeeper, player, guest]) {
      expect(memberActions(admin, target, all).canReport).toBe(true);
      expect(memberActions(admin, target, all).roles).not.toBeNull();
    }
    const me = member("c2", "coAdmin", { isMe: true });
    expect(memberActions(me, { ...admin, isMe: false }, [...all, me]).canReport).toBe(true);
  });

  test("no role reports its own row (E6.6)", () => {
    for (const role of ["admin", "coAdmin", "scorekeeper", "player"] as const) {
      const me = member("me", role, { isMe: true });
      expect(memberActions(me, me, [admin, me]).canReport).toBe(false);
    }
  });

  test("the own row of Placar or Jogador offers only Sair", () => {
    const me = { ...scorekeeper, isMe: true };
    expect(memberActions(me, me, [admin, me])).toEqual({
      target: me,
      roles: null,
      type: null,
      canLeave: true,
      canRemove: false,
      canReport: false,
      showsLevel: false,
      lastAdmin: false,
    });
  });

  test("the last admin cannot leave nor demote itself", () => {
    const sheet = memberActions(admin, admin, [admin, coAdmin]);
    expect(sheet.lastAdmin).toBe(true);
    expect(sheet.canLeave).toBe(true);
    expect(sheet.roles?.map((chip) => chip.state)).toEqual([
      "current",
      "disabled",
      "disabled",
      "disabled",
    ]);
  });

  test("an admin with another admin may demote itself", () => {
    const sheet = memberActions(admin, admin, [admin, otherAdmin]);
    expect(sheet.lastAdmin).toBe(false);
    expect(sheet.roles?.map((chip) => chip.state)).toEqual([
      "current",
      "enabled",
      "enabled",
      "enabled",
    ]);
  });

  test("a co-admin never demotes itself, but changes its own type", () => {
    const me = { ...coAdmin, isMe: true };
    const sheet = memberActions(me, me, [admin, me]);
    expect(sheet.roles?.filter((chip) => chip.state === "enabled")).toEqual([]);
    expect(sheet.type).toEqual({ regularBlocked: false });
    expect(sheet.canLeave).toBe(true);
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
