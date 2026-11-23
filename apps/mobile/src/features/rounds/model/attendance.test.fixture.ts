import {
  applyTemplate,
  defaultGroupSettings,
  getSettingsTemplate,
  type GroupSettings,
} from "@sacou/match-engine";

import type { Member, MemberType, Round } from "../../../services/api/sacou-api";
import { withLeaf } from "../../groups/model/settings-patch";

export const ME = "m-me";

/** The group of RodadaJogador.dc.html: attendance and waitlist on. */
export function attendanceSettings(waitlistEnabled = true): GroupSettings {
  const base = applyTemplate(defaultGroupSettings(), getSettingsTemplate("racha-organizado"));
  return withLeaf(
    withLeaf(base, "attendance.enabled", true),
    "attendance.waitlistEnabled",
    waitlistEnabled,
  );
}

export function memberOf(
  memberId: string,
  nickname: string | null,
  patch: Partial<Member> = {},
): Member {
  return {
    memberId,
    role: "player",
    memberType: "dropIn",
    hasAccount: true,
    isMe: memberId === ME,
    joinedAt: "2026-10-01T00:00:00Z",
    nickname,
    primaryPosition: null,
    otherPositions: [],
    ...patch,
  };
}

export function goingOf(memberId: string, position: number, memberType: MemberType = "dropIn") {
  return { memberId, memberType, source: "self" as const, position, promoted: false };
}

export function waitOf(memberId: string, position: number) {
  return { memberId, memberType: "dropIn" as const, position };
}

/** Qui 5/11 19h in São Paulo (UTC-3), 12 spots. */
export function attendanceRound(patch: Partial<Round> = {}): Round {
  const settings = attendanceSettings();
  return {
    roundId: "r1",
    seriesId: null,
    localDate: "2026-11-05",
    localTime: "19:00",
    timeZone: "America/Sao_Paulo",
    startsAt: "2026-11-05T22:00:00Z",
    closedAt: null,
    endsAt: "2026-11-06T04:00:00Z",
    dropInOpensAt: null,
    venue: "Arena Beira-Mar",
    status: "scheduled",
    settings: { schemaVersion: 1, layer: null, resolved: settings, sources: {} },
    capacity: 12,
    goingCount: 0,
    waitlistCount: 0,
    going: [],
    waitlist: [],
    me: { memberId: ME, status: null, position: null, regularPosition: null },
    teams: null,
    ...patch,
  };
}

/** Before the round: Monday 2/11, noon in São Paulo. */
export const BEFORE = Date.parse("2026-11-02T15:00:00Z");
