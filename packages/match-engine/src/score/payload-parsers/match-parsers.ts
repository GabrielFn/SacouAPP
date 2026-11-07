// Payloads of the match: MatchStarted and MatchEnded.
import { ok } from "@sacou/volley-rules";

import { isUuid } from "../../event-log/is-uuid.js";
import { BEST_OF_VALUES, END_REASONS, WIN_MARGIN_VALUES } from "../constants.data.js";
import type { MatchEndedPayload, MatchStartedPayload, ScoringRules } from "../types.js";
import {
  invalid,
  isOneOf,
  isPlainObject,
  isSetPoints,
  isTeamSide,
  isVersion,
  readOwn,
  type ParseResult,
  type RawObject,
} from "./payload-reading.js";
import { parseMatchQueue } from "./queue-parsers.js";
import { parseRotations, parseTeams } from "./team-parsers.js";

function parseScoring(raw: unknown): ParseResult<ScoringRules> {
  if (!isPlainObject(raw)) return invalid("scoring");
  const bestOf = readOwn(raw, "bestOf");
  if (!isOneOf(BEST_OF_VALUES, bestOf)) return invalid("scoring.bestOf");
  const pointsPerSet = readOwn(raw, "pointsPerSet");
  if (!isSetPoints(pointsPerSet)) return invalid("scoring.pointsPerSet");
  const tieBreakPoints = readOwn(raw, "tieBreakPoints");
  if (tieBreakPoints !== null && !isSetPoints(tieBreakPoints)) {
    return invalid("scoring.tieBreakPoints");
  }
  const winMargin = readOwn(raw, "winMargin");
  if (!isOneOf(WIN_MARGIN_VALUES, winMargin)) return invalid("scoring.winMargin");
  return ok({ bestOf, pointsPerSet, tieBreakPoints, winMargin });
}

export function parseMatchStartedFields(raw: RawObject): ParseResult<MatchStartedPayload> {
  const matchId = readOwn(raw, "matchId");
  if (!isUuid(matchId)) return invalid("matchId");
  const rulesVersion = readOwn(raw, "rulesVersion");
  if (!isVersion(rulesVersion)) return invalid("rulesVersion");
  const formationsVersion = readOwn(raw, "formationsVersion");
  if (!isVersion(formationsVersion)) return invalid("formationsVersion");
  const scoring = parseScoring(readOwn(raw, "scoring"));
  if (!scoring.ok) return scoring;
  const teams = parseTeams(readOwn(raw, "teams"));
  if (!teams.ok) return teams;
  const firstServer = readOwn(raw, "firstServer");
  if (!isTeamSide(firstServer)) return invalid("firstServer");
  const rotations = parseRotations(readOwn(raw, "rotations"), teams.value);
  if (!rotations.ok) return rotations;
  const queue = parseMatchQueue(readOwn(raw, "queue"), teams.value);
  if (!queue.ok) return queue;
  return ok({
    firstServer,
    formationsVersion,
    matchId,
    queue: queue.value,
    rotations: rotations.value,
    rulesVersion,
    scoring: scoring.value,
    teams: teams.value,
  });
}

export function parseMatchEndedFields(raw: RawObject): ParseResult<MatchEndedPayload> {
  const matchId = readOwn(raw, "matchId");
  if (!isUuid(matchId)) return invalid("matchId");
  const endReason = readOwn(raw, "endReason");
  if (!isOneOf(END_REASONS, endReason)) return invalid("endReason");
  const winner = readOwn(raw, "winner");
  if (winner !== null && !isTeamSide(winner)) return invalid("winner");
  if (endReason === "sets-won" && winner === null) return invalid("winner");
  return ok({ endReason, matchId, winner });
}
