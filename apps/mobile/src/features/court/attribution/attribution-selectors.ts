import {
  getAttributionRally,
  getOpponent,
  getTeamServeAlignment,
  isPlausibleAuthor,
  onCourtInTheRally,
  type CourtSessionTimeline,
  type MemberId,
  type Rally,
  type SetScore,
} from "@sacou/match-engine";

import { strings } from "../../../strings/pt-BR";
import type { CourtRoster } from "../ports/court-roster";
import { RALLY_DISPLAY_SLOTS } from "./attribution.data";
import type { AttributionState, AuthoredPointKind } from "./attribution.reducer";

const FIRST_SLOT = 1;
const FREE_SYSTEM = "livre";
const AUTHORED_KINDS: readonly AuthoredPointKind[] = ["attack", "block", "ace", "other"];

export interface KindOption {
  readonly kind: AuthoredPointKind;
  readonly label: string;
  readonly selected: boolean;
  /** Someone of the rally could have scored it so: an ace of a team that received has nobody. */
  readonly enabled: boolean;
}

export interface AuthorOption {
  readonly memberId: MemberId;
  readonly name: string;
  /** "pos 2", "pos 1 · sacou"; `null` with the rotation of the team off. */
  readonly detail: string | null;
  /** "L" on the setter, "Lí" on the libero. */
  readonly badge: string | null;
  /** Only a guide (ADR 0031, P1): the command checks it again. */
  readonly enabled: boolean;
  readonly accessibilityLabel: string;
}

/** What screen 31 shows for the point it asks about, read from the state right before the point. */
export interface AttributionSheetModel {
  readonly pointEventId: string;
  readonly title: string;
  readonly kinds: readonly KindOption[];
  readonly teamOnCourt: string;
  readonly players: readonly AuthorOption[];
  readonly opponentError: string;
  readonly refusal: string | null;
}

interface PlayerContext {
  readonly rally: Rally;
  readonly kind: AuthoredPointKind;
  readonly roster: CourtRoster;
  readonly setter: MemberId | null;
}

function scoreAfter(timeline: CourtSessionTimeline, pointEventId: string): SetScore | null {
  const entry = timeline.entries.find(({ event }) => event.eventId === pointEventId);
  return entry?.state.currentMatch?.currentSet?.score ?? null;
}

function actingSetter({ match, team }: Rally): MemberId | null {
  const alignment = getTeamServeAlignment(match, team);
  return alignment === null || alignment.system === FREE_SYSTEM ? null : alignment.actingSetter;
}

function badgeOf({ rally, setter }: PlayerContext, memberId: MemberId): string | null {
  const { zone } = strings.court;
  if (rally.match.rotations[rally.team]?.libero?.memberId === memberId) {
    return zone.liberoBadge;
  }
  return memberId === setter ? zone.setterBadge : null;
}

function roleOf(badge: string | null): string | null {
  const { zone } = strings.court;
  if (badge === null) {
    return null;
  }
  return badge === zone.liberoBadge ? zone.liberoLabel : zone.setterLabel;
}

function slotDetail({ rally }: PlayerContext, slot: number | null): string | null {
  const { attribution } = strings.courtPlayers;
  if (slot === null) {
    return null;
  }
  const served = slot === FIRST_SLOT && rally.servingTeam === rally.team;
  return served ? attribution.served(slot) : attribution.position(slot);
}

function optionOf(context: PlayerContext, memberId: MemberId, slot: number | null): AuthorOption {
  const { attribution } = strings.courtPlayers;
  const name = context.roster.nameOf(memberId);
  const detail = slotDetail(context, slot);
  const badge = badgeOf(context, memberId);
  const enabled = isPlausibleAuthor(context.rally, context.kind, memberId);
  const label = attribution.playerLabel(name, detail, roleOf(badge));
  return {
    memberId,
    name,
    detail,
    badge,
    enabled,
    accessibilityLabel: enabled
      ? label
      : attribution.playerLabel(label, null, attribution.notPlausible),
  };
}

/** The players of the rally, never of the court now: turning the rotation later changes nothing. */
function rallyPlayers(context: PlayerContext): readonly AuthorOption[] {
  const { match, servingTeam, team } = context.rally;
  const onCourt = onCourtInTheRally(match, servingTeam, team);
  if (match.rotations[team] === null) {
    return onCourt.map((memberId) => optionOf(context, memberId, null));
  }
  return RALLY_DISPLAY_SLOTS.flatMap((slot) => {
    const memberId = onCourt[slot - FIRST_SLOT];
    return memberId === undefined ? [] : [optionOf(context, memberId, slot)];
  });
}

function kindOptions(rally: Rally, picked: AuthoredPointKind, onCourt: readonly MemberId[]) {
  const { kinds } = strings.courtPlayers.attribution;
  return AUTHORED_KINDS.map((kind) => ({
    kind,
    label: kinds[kind],
    selected: kind === picked,
    enabled: onCourt.some((memberId) => isPlausibleAuthor(rally, kind, memberId)),
  }));
}

/** Screen 31 for the point of the state, or `null` when closed or the point left the open match. */
export function attributionSheet(
  timeline: CourtSessionTimeline,
  roster: CourtRoster,
  state: AttributionState,
): AttributionSheetModel | null {
  if (state.status === "closed") {
    return null;
  }
  const rally = getAttributionRally(timeline, state.pointEventId);
  const score = scoreAfter(timeline, state.pointEventId);
  if (rally === null || score === null) {
    return null;
  }
  const { attribution } = strings.courtPlayers;
  const { matchId } = rally.match;
  const teamLabel = roster.teamAppearance(matchId, rally.team).label;
  const context = { rally, kind: state.kind, roster, setter: actingSetter(rally) };
  const players = rallyPlayers(context);
  return {
    pointEventId: state.pointEventId,
    title: attribution.title(teamLabel, score.a, score.b),
    kinds: kindOptions(
      rally,
      state.kind,
      players.map(({ memberId }) => memberId),
    ),
    teamOnCourt: attribution.onCourt(teamLabel),
    players,
    opponentError: attribution.opponentError(
      roster.teamAppearance(matchId, getOpponent(rally.team)).label,
    ),
    refusal: state.refusal,
  };
}
