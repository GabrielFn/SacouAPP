import { err, ok, type Result } from "@sacou/volley-rules";

import type { TimelineEntry } from "../event-log/types.js";
import { TEAM_SIDES } from "../score/constants.data.js";
import { getCurrentServingPlayer } from "../score/rotation-rules.js";
import type { CourtSessionState, MatchScore, TeamSide } from "../score/types.js";
import { findRevertTargetIndex } from "./commands.js";
import { REMOVED_ACTION_KEYS } from "./constants.data.js";
import type {
  CorrectionError,
  CourtSessionTimeline,
  RemovedActions,
  RevertPreview,
  RotationChange,
  SetSnapshot,
} from "./types.js";

const NO_REMOVED_ACTIONS: RemovedActions = {
  points: 0,
  lineupChanges: 0,
  queueChanges: 0,
  servingChanges: 0,
  setEnds: 0,
  attributions: 0,
};

function snapshotOf(match: MatchScore | null): SetSnapshot | null {
  const set = match?.currentSet ?? null;
  return set === null ? null : { setNumber: set.setNumber, score: set.score };
}

function rotationChangeOf(
  current: MatchScore | null,
  reverted: MatchScore | null,
  team: TeamSide,
): readonly RotationChange[] {
  const from = current?.rotations[team]?.setterZone;
  const to = reverted?.rotations[team]?.setterZone;
  return from === undefined || to === undefined || from === to ? [] : [{ team, from, to }];
}

function countRemoved(removed: readonly TimelineEntry<CourtSessionState>[]): RemovedActions {
  return removed.reduce((counts, { event }) => {
    const key = REMOVED_ACTION_KEYS.get(event.type);
    return key === undefined ? counts : { ...counts, [key]: counts[key] + 1 };
  }, NO_REMOVED_ACTIONS);
}

function buildPreview(
  current: CourtSessionState,
  timeline: CourtSessionTimeline,
  index: number,
): RevertPreview | null {
  const target = timeline.entries[index];
  if (target === undefined) {
    return null;
  }
  const now = current.currentMatch;
  const after = target.state.currentMatch;
  return {
    targetEventId: target.event.eventId,
    current: snapshotOf(now),
    reverted: snapshotOf(after),
    servingTeam: after?.currentSet?.servingTeam ?? null,
    servingPlayer: after === null ? null : getCurrentServingPlayer(after),
    rotationChanges: TEAM_SIDES.flatMap((team) => rotationChangeOf(now, after, team)),
    removed: countRemoved(timeline.entries.slice(index + 1)),
  };
}

/**
 * What a revert to `eventId` would change, for the dialog of screen 24, with the same refusals as
 * `revertToEvent`. It records nothing.
 */
export function previewRevert(
  timeline: CourtSessionTimeline,
  eventId: string,
): Result<RevertPreview, CorrectionError> {
  const index = findRevertTargetIndex(timeline, eventId);
  if (!index.ok) {
    return index;
  }
  const current = timeline.entries.at(-1);
  const preview = current === undefined ? null : buildPreview(current.state, timeline, index.value);
  return preview === null ? err({ code: "invalid-revert-target" }) : ok(preview);
}
