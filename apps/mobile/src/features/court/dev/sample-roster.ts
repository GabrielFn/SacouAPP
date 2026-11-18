import type { MemberId, TeamSide } from "@sacou/match-engine";

import { strings } from "../../../strings/pt-BR";
import type { CourtRoster, TeamAppearance } from "../ports/court-roster";
import {
  SAMPLE_BLUE_LINEUP,
  SAMPLE_LIBERO_ID,
  SAMPLE_LONG_BLUE_LINEUP,
  SAMPLE_LONG_LIBERO_ID,
  SAMPLE_LONG_ORANGE_LINEUP,
  SAMPLE_LONG_QUEUE_PLAYERS,
  SAMPLE_ORANGE_LINEUP,
  SAMPLE_QUEUE_PLAYERS,
} from "./sample-match.data";
import {
  SAMPLE_BLUE_NAMES,
  SAMPLE_LIBERO_NAME,
  SAMPLE_LONG_BLUE_NAMES,
  SAMPLE_LONG_LIBERO_NAME,
  SAMPLE_LONG_ORANGE_NAMES,
  SAMPLE_LONG_QUEUE_NAMES,
  SAMPLE_ORANGE_NAMES,
  SAMPLE_QUEUE_NAMES,
} from "./sample-names.data";

const SAMPLE_TEAMS: Readonly<Record<TeamSide, TeamAppearance>> = {
  a: { label: strings.court.roster.orange, color: "orange" },
  b: { label: strings.court.roster.blue, color: "blue" },
};

function namesById(
  ids: readonly MemberId[],
  names: readonly string[],
): readonly [string, string][] {
  return ids.map((id, index) => [id, names[index] ?? ""]);
}

const SAMPLE_NAMES: ReadonlyMap<MemberId, string> = new Map([
  ...namesById(SAMPLE_ORANGE_LINEUP, SAMPLE_ORANGE_NAMES),
  ...namesById(SAMPLE_BLUE_LINEUP, SAMPLE_BLUE_NAMES),
  [SAMPLE_LIBERO_ID, SAMPLE_LIBERO_NAME],
  ...namesById(SAMPLE_QUEUE_PLAYERS, SAMPLE_QUEUE_NAMES),
  ...namesById(SAMPLE_LONG_ORANGE_LINEUP, SAMPLE_LONG_ORANGE_NAMES),
  ...namesById(SAMPLE_LONG_BLUE_LINEUP, SAMPLE_LONG_BLUE_NAMES),
  [SAMPLE_LONG_LIBERO_ID, SAMPLE_LONG_LIBERO_NAME],
  ...namesById(SAMPLE_LONG_QUEUE_PLAYERS, SAMPLE_LONG_QUEUE_NAMES),
]);

/** The names of the design screens 09 and 10. */
export function createSampleRoster(): CourtRoster {
  return {
    nameOf: (memberId) => SAMPLE_NAMES.get(memberId) ?? strings.court.roster.unknownPlayer,
    // The sample has no profiles: nobody is ever out of place on screen 22.
    positionOf: () => null,
    teamAppearance: (_matchId, side) => SAMPLE_TEAMS[side],
  };
}
