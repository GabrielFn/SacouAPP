import type { GroupRole, Member } from "../../../services/api/sacou-api";

export const GROUP = "8a4c2f0e-1111-4c3b-9d2e-000000000001";

/** A member of the list as the API sends it before the names (E3.17). */
export function member(memberId: string, role: GroupRole, overrides: Partial<Member> = {}): Member {
  return {
    memberId,
    role,
    memberType: "dropIn",
    hasAccount: true,
    isMe: false,
    joinedAt: "2026-10-12T20:00:00Z",
    nickname: null,
    primaryPosition: null,
    otherPositions: [],
    ...overrides,
  };
}
