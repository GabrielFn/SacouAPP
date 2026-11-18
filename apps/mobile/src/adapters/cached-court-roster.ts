import type { MemberId, TeamSide } from "@sacou/match-engine";
import type { Query, QueryClient } from "@tanstack/react-query";

import type { CourtRoster, TeamAppearance } from "../features/court/ports/court-roster";
import type { Member } from "../services/api/sacou-api";
import { strings } from "../strings/pt-BR";

const { roster } = strings.court;

/** Team A is orange and team B blue, by side (pendencias.md, E2.6). */
const TEAMS: Readonly<Record<TeamSide, TeamAppearance>> = {
  a: { label: roster.orange, color: "orange" },
  b: { label: roster.blue, color: "blue" },
};

const MEMBERS_KEY_LENGTH = 3;

/** `["groups", groupId, "members"]`: the lists of members of every group in the cache. */
function isMembersQuery(query: Pick<Query, "queryKey">): boolean {
  const [root, groupId, child] = query.queryKey;
  return (
    query.queryKey.length === MEMBERS_KEY_LENGTH &&
    root === "groups" &&
    typeof groupId === "string" &&
    child === "members"
  );
}

function isMemberList(data: unknown): data is readonly Member[] {
  return Array.isArray(data);
}

function membersOf(client: QueryClient): ReadonlyMap<MemberId, Member> {
  const lists = client
    .getQueryCache()
    .findAll({ predicate: isMembersQuery })
    .map((query) => query.state.data)
    .filter(isMemberList);
  return new Map(lists.flatMap((members) => members.map((member) => [member.memberId, member])));
}

function nicknameOf(member: Member | undefined): string | null {
  const nickname = member?.nickname ?? null;
  return nickname === null || nickname.trim() === "" ? null : nickname;
}

/**
 * The names (and positions) of the court from the members in the TanStack cache (D7): a `MemberId` is a GUID, so any
 * group's list will do. The members are persisted for a week (E4.2), so the court has its names with
 * no network. The map is rebuilt only after the cache changes; nothing from here reaches the court log.
 * `fallback` is the sample roster of the development screen (`EXPO_PUBLIC_DEV_TOOLS`).
 */
export function createCachedCourtRoster(
  client: QueryClient,
  fallback: CourtRoster | null = null,
): CourtRoster {
  const memo: { current: ReadonlyMap<MemberId, Member> | null } = { current: null };
  client.getQueryCache().subscribe(() => {
    memo.current = null;
  });
  const members = () => {
    memo.current ??= membersOf(client);
    return memo.current;
  };
  return {
    nameOf: (memberId) =>
      nicknameOf(members().get(memberId)) ?? fallback?.nameOf(memberId) ?? roster.unknownPlayer,
    positionOf: (memberId) =>
      members().get(memberId)?.primaryPosition ?? fallback?.positionOf(memberId) ?? null,
    teamAppearance: (_matchId, side) => TEAMS[side],
  };
}
