import {
  SERVING_TEAM_CHANGED_EVENT_TYPE,
  getRecentPoints,
  nextSetterZone,
  previousSetterZone,
  previewRevert,
  type CourtSessionTimeline,
  type RecentPoint,
  type RemovedActions,
  type RevertPreview,
  type TeamSide,
} from "@sacou/match-engine";
import type { SetterZone } from "@sacou/volley-rules";

import { strings } from "../../../strings/pt-BR";
import type { TeamColorName } from "../../../theme/team-colors";
import { stateOfTimeline } from "../model/court-screen.selectors";
import type { CourtRoster } from "../ports/court-roster";

const FIRST_ROW = 0;
const NONE = 0;

export interface TimelineRowModel {
  readonly eventId: string;
  readonly team: TeamSide;
  readonly color: TeamColorName;
  readonly scoreText: string;
  readonly serveName: string | null;
  readonly serveText: string;
  readonly sideOutText: string | null;
  /** The newest point is the state now: picking it would go back to where it already is. */
  readonly selectable: boolean;
  readonly selected: boolean;
  /** Newer than the picked point: the revert would erase it. */
  readonly willUndo: boolean;
  readonly accessibilityLabel: string;
}

function sideOutTextOf(point: RecentPoint): string | null {
  if (!point.sideOut) {
    return null;
  }
  const { corrections } = strings.court;
  return point.setterZone === null
    ? corrections.sideOut
    : corrections.sideOutRotation(point.setterZone);
}

/** The picked point, if it is still on the list and is not the newest; otherwise `null`. */
export function effectiveSelection(
  timeline: CourtSessionTimeline,
  selected: string | null,
): string | null {
  const points = getRecentPoints(timeline);
  const index = points.findIndex(({ eventId }) => eventId === selected);
  return index > FIRST_ROW ? (points[index]?.eventId ?? null) : null;
}

function spokenLabel(
  point: RecentPoint,
  teamLabel: string,
  serve: string,
  marks: readonly (string | null)[],
): string {
  const { corrections } = strings.court;
  const sideOut = point.sideOut ? corrections.rowSideOutLabel(teamLabel, point.setterZone) : null;
  const base = corrections.rowLabel(point.score.a, point.score.b, teamLabel, serve, sideOut);
  return corrections.spokenParts([base, ...marks].filter((part) => part !== null));
}

function rowOf(
  point: RecentPoint,
  index: number,
  selectedIndex: number,
  matchId: string,
  roster: CourtRoster,
): TimelineRowModel {
  const { corrections } = strings.court;
  const appearance = roster.teamAppearance(matchId, point.team);
  const serveName = point.servingPlayer === null ? null : roster.nameOf(point.servingPlayer);
  const serverTeam = roster.teamAppearance(matchId, point.servingTeam).label;
  const serveText = serveName === null ? corrections.servesTeam(serverTeam) : corrections.serves;
  const selected = index === selectedIndex;
  const willUndo = selectedIndex > FIRST_ROW && index < selectedIndex;
  const serve = serveName === null ? serveText : corrections.serveWithName(serveText, serveName);
  return {
    eventId: point.eventId,
    team: point.team,
    color: appearance.color,
    scoreText: corrections.score(point.score.a, point.score.b),
    serveName,
    serveText,
    sideOutText: sideOutTextOf(point),
    selectable: index > FIRST_ROW,
    selected,
    willUndo,
    accessibilityLabel: spokenLabel(point, appearance.label, serve, [
      selected ? corrections.selected : null,
      willUndo ? corrections.willUndo : null,
    ]),
  };
}

/** The lines of screen 24, newest first. The picked point and the lines it would erase are marked. */
export function timelineRows(
  timeline: CourtSessionTimeline,
  roster: CourtRoster,
  selected: string | null,
): readonly TimelineRowModel[] {
  const matchId = stateOfTimeline(timeline).currentMatch?.matchId;
  const points = getRecentPoints(timeline);
  const selectedIndex = points.findIndex(({ eventId }) => eventId === selected);
  return matchId === undefined
    ? []
    : points.map((point, index) => rowOf(point, index, selectedIndex, matchId, roster));
}

/** "2º set · Laranja 18–15 Azul · últimos 10 pontos"; `null` without a set in play. */
export function correctionsSubtitle(
  timeline: CourtSessionTimeline,
  roster: CourtRoster,
): string | null {
  const match = stateOfTimeline(timeline).currentMatch;
  const set = match?.currentSet ?? null;
  if (match === null || set === null) {
    return null;
  }
  const { menu, corrections } = strings.court;
  const scoreLine = menu.scoreLine(
    roster.teamAppearance(match.matchId, "a").label,
    set.score.a,
    set.score.b,
    roster.teamAppearance(match.matchId, "b").label,
  );
  return corrections.subtitle(set.setNumber, scoreLine, getRecentPoints(timeline).length);
}

export function currentSetNumber(timeline: CourtSessionTimeline): number | null {
  return stateOfTimeline(timeline).currentMatch?.currentSet?.setNumber ?? null;
}

export interface RevertSheetModel {
  readonly title: string;
  readonly currentScore: string;
  readonly revertedScore: string;
  readonly serveText: string | null;
  readonly rotationTexts: readonly string[];
  readonly removedPointsText: string;
  readonly removedAlsoText: string | null;
}

function removedParts(removed: RemovedActions): readonly string[] {
  const { corrections } = strings.court;
  const { servingChanges, setEnds, attributions, lineupChanges, queueChanges } = removed;
  return [
    servingChanges > NONE ? corrections.removedServing(servingChanges) : null,
    setEnds > NONE ? corrections.removedSetEnds(setEnds) : null,
    attributions > NONE ? corrections.removedAttributions(attributions) : null,
    lineupChanges > NONE ? corrections.removedLineups(lineupChanges) : null,
    queueChanges > NONE ? corrections.removedQueues(queueChanges) : null,
  ].filter((part) => part !== null);
}

function scoreOf(snapshot: RevertPreview["current"]): string {
  return snapshot === null
    ? ""
    : strings.court.corrections.score(snapshot.score.a, snapshot.score.b);
}

function titleOf(reverted: RevertPreview["reverted"]): string {
  const score = reverted?.score ?? { a: NONE, b: NONE };
  return strings.court.corrections.revertTitle(score.a, score.b);
}

function serveTextOf(
  { servingTeam, servingPlayer }: RevertPreview,
  roster: CourtRoster,
  label: (side: TeamSide) => string,
): string | null {
  if (servingTeam === null) {
    return null;
  }
  const name = servingPlayer === null ? null : roster.nameOf(servingPlayer);
  return strings.court.corrections.revertServeReturns(label(servingTeam), name);
}

/** What the sheet "Voltar o jogo para 16x14?" shows, from the preview of the engine; `null` if it refuses. */
export function revertSheet(
  timeline: CourtSessionTimeline,
  roster: CourtRoster,
  eventId: string | null,
): RevertSheetModel | null {
  const matchId = stateOfTimeline(timeline).currentMatch?.matchId;
  const preview = eventId === null ? null : previewRevert(timeline, eventId);
  if (matchId === undefined || preview === null || !preview.ok) {
    return null;
  }
  const { corrections } = strings.court;
  const { current, reverted, rotationChanges, removed } = preview.value;
  const label = (side: TeamSide) => roster.teamAppearance(matchId, side).label;
  const also = removedParts(removed);
  return {
    title: titleOf(reverted),
    currentScore: scoreOf(current),
    revertedScore: scoreOf(reverted),
    serveText: serveTextOf(preview.value, roster, label),
    rotationTexts: rotationChanges.map(({ team, to }) =>
      corrections.revertRotationReturns(label(team), to),
    ),
    removedPointsText: corrections.removedPoints(removed.points),
    removedAlsoText: also.length === NONE ? null : corrections.removedAlso(also),
  };
}

export interface ShiftOption {
  readonly side: TeamSide;
  readonly label: string;
  readonly color: TeamColorName;
  /** `null`: the rotation of the team is off. */
  readonly zone: SetterZone | null;
  readonly forwardText: string | null;
  readonly backwardText: string | null;
}

/** One option per team for the sheet of "Girar / desgirar". */
export function shiftOptions(
  timeline: CourtSessionTimeline,
  roster: CourtRoster,
): readonly ShiftOption[] {
  const match = stateOfTimeline(timeline).currentMatch;
  if (match === null) {
    return [];
  }
  const { corrections } = strings.court;
  return (["a", "b"] as const).map((side) => {
    const { label, color } = roster.teamAppearance(match.matchId, side);
    const zone = match.rotations[side]?.setterZone ?? null;
    return {
      side,
      label,
      color,
      zone,
      forwardText:
        zone === null ? null : corrections.shiftChange(label, zone, nextSetterZone(zone)),
      backwardText:
        zone === null ? null : corrections.shiftChange(label, zone, previousSetterZone(zone)),
    };
  });
}

/** "Girar" has nothing to do when neither team has a rotation. */
export function canShift(options: readonly ShiftOption[]): boolean {
  return options.some(({ zone }) => zone !== null);
}

/** "Agora saca o Azul.": only while the last action on the timeline is the change of serve. */
export function servingNotice(timeline: CourtSessionTimeline, roster: CourtRoster): string | null {
  const last = timeline.entries.at(-1);
  const match = last?.state.currentMatch ?? null;
  const set = match?.currentSet ?? null;
  if (last?.event.type !== SERVING_TEAM_CHANGED_EVENT_TYPE || match === null || set === null) {
    return null;
  }
  const team = roster.teamAppearance(match.matchId, set.servingTeam).label;
  const { corrections } = strings.court;
  return set.score.a + set.score.b === NONE
    ? corrections.servingAtStart(team)
    : corrections.servingNow(team);
}
