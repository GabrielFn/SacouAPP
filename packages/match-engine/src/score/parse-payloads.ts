import {
  LINEUP_CHANGED_EVENT_TYPE,
  MATCH_ENDED_EVENT_TYPE,
  MATCH_STARTED_EVENT_TYPE,
  PAYLOAD_ROOT_FIELD,
  POINT_ATTRIBUTED_EVENT_TYPE,
  POINT_SCORED_EVENT_TYPE,
  QUEUE_CHANGED_EVENT_TYPE,
  SCORE_PAYLOAD_SHAPES,
  SERVING_TEAM_CHANGED_EVENT_TYPE,
  SET_ENDED_EVENT_TYPE,
} from "./constants.data.js";
import {
  parseLineupChangedFields,
  parsePointAttributedFields,
  parseQueueChangedFields,
} from "./payload-parsers/change-parsers.js";
import { parseMatchEndedFields, parseMatchStartedFields } from "./payload-parsers/match-parsers.js";
import {
  invalid,
  strictParser,
  type ParseResult,
  type PayloadParser,
} from "./payload-parsers/payload-reading.js";
import {
  parsePointScoredFields,
  parseServingTeamChangedFields,
  parseSetEndedFields,
} from "./payload-parsers/set-parsers.js";
import type {
  LineupChangedPayload,
  MatchEndedPayload,
  MatchStartedPayload,
  PointAttributedPayload,
  PointScoredPayload,
  QueueChangedPayload,
  ScorePayload,
  ServingTeamChangedPayload,
  SetEndedPayload,
} from "./types.js";

export const parseMatchStartedPayload: PayloadParser<MatchStartedPayload> = strictParser(
  SCORE_PAYLOAD_SHAPES[MATCH_STARTED_EVENT_TYPE],
  parseMatchStartedFields,
);

export const parsePointScoredPayload: PayloadParser<PointScoredPayload> = strictParser(
  SCORE_PAYLOAD_SHAPES[POINT_SCORED_EVENT_TYPE],
  parsePointScoredFields,
);

export const parseSetEndedPayload: PayloadParser<SetEndedPayload> = strictParser(
  SCORE_PAYLOAD_SHAPES[SET_ENDED_EVENT_TYPE],
  parseSetEndedFields,
);

export const parseMatchEndedPayload: PayloadParser<MatchEndedPayload> = strictParser(
  SCORE_PAYLOAD_SHAPES[MATCH_ENDED_EVENT_TYPE],
  parseMatchEndedFields,
);

export const parseLineupChangedPayload: PayloadParser<LineupChangedPayload> = strictParser(
  SCORE_PAYLOAD_SHAPES[LINEUP_CHANGED_EVENT_TYPE],
  parseLineupChangedFields,
);

export const parseQueueChangedPayload: PayloadParser<QueueChangedPayload> = strictParser(
  SCORE_PAYLOAD_SHAPES[QUEUE_CHANGED_EVENT_TYPE],
  parseQueueChangedFields,
);

export const parseServingTeamChangedPayload: PayloadParser<ServingTeamChangedPayload> =
  strictParser(
    SCORE_PAYLOAD_SHAPES[SERVING_TEAM_CHANGED_EVENT_TYPE],
    parseServingTeamChangedFields,
  );

export const parsePointAttributedPayload: PayloadParser<PointAttributedPayload> = strictParser(
  SCORE_PAYLOAD_SHAPES[POINT_ATTRIBUTED_EVENT_TYPE],
  parsePointAttributedFields,
);

const PARSERS_BY_TYPE: ReadonlyMap<string, PayloadParser<ScorePayload>> = new Map<
  string,
  PayloadParser<ScorePayload>
>([
  [MATCH_STARTED_EVENT_TYPE, parseMatchStartedPayload],
  [POINT_SCORED_EVENT_TYPE, parsePointScoredPayload],
  [SET_ENDED_EVENT_TYPE, parseSetEndedPayload],
  [MATCH_ENDED_EVENT_TYPE, parseMatchEndedPayload],
  [LINEUP_CHANGED_EVENT_TYPE, parseLineupChangedPayload],
  [QUEUE_CHANGED_EVENT_TYPE, parseQueueChangedPayload],
  [SERVING_TEAM_CHANGED_EVENT_TYPE, parseServingTeamChangedPayload],
  [POINT_ATTRIBUTED_EVENT_TYPE, parsePointAttributedPayload],
]);

/** Fails closed: a type outside the score catalog has no valid payload here. */
export function parseScorePayload(type: string, payload: unknown): ParseResult<ScorePayload> {
  const parser = PARSERS_BY_TYPE.get(type);
  return parser === undefined ? invalid(PAYLOAD_ROOT_FIELD) : parser(payload);
}
