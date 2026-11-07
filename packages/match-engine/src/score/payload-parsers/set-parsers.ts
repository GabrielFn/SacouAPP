// Payloads of a set: PointScored, SetEnded and ServingTeamChanged.
import { ok } from "@sacou/volley-rules";

import type {
  NextSet,
  PointScoredPayload,
  ServingTeamChangedPayload,
  SetEndedPayload,
  SetterZones,
} from "../types.js";
import {
  invalid,
  isPlainObject,
  isSetPoints,
  isSetterZone,
  isTeamSide,
  readMatchAndSet,
  readOwn,
  type ParseResult,
  type RawObject,
} from "./payload-reading.js";

function parseSetterZones(raw: unknown): ParseResult<SetterZones> {
  if (!isPlainObject(raw)) return invalid("nextSet.setterZones");
  const a = readOwn(raw, "a");
  if (a !== null && !isSetterZone(a)) return invalid("nextSet.setterZones.a");
  const b = readOwn(raw, "b");
  if (b !== null && !isSetterZone(b)) return invalid("nextSet.setterZones.b");
  return ok({ a, b });
}

function parseNextSet(raw: unknown): ParseResult<NextSet | null> {
  if (raw === null) return ok(null);
  if (!isPlainObject(raw)) return invalid("nextSet");
  const targetPoints = readOwn(raw, "targetPoints");
  if (!isSetPoints(targetPoints)) return invalid("nextSet.targetPoints");
  const firstServer = readOwn(raw, "firstServer");
  if (!isTeamSide(firstServer)) return invalid("nextSet.firstServer");
  const setterZones = parseSetterZones(readOwn(raw, "setterZones"));
  if (!setterZones.ok) return setterZones;
  return ok({ firstServer, setterZones: setterZones.value, targetPoints });
}

export function parsePointScoredFields(raw: RawObject): ParseResult<PointScoredPayload> {
  const head = readMatchAndSet(raw);
  if (!head.ok) return head;
  const { matchId, setNumber } = head.value;
  const team = readOwn(raw, "team");
  if (!isTeamSide(team)) return invalid("team");
  return ok({ matchId, setNumber, team });
}

export function parseSetEndedFields(raw: RawObject): ParseResult<SetEndedPayload> {
  const head = readMatchAndSet(raw);
  if (!head.ok) return head;
  const { matchId, setNumber } = head.value;
  const winner = readOwn(raw, "winner");
  if (!isTeamSide(winner)) return invalid("winner");
  const nextSet = parseNextSet(readOwn(raw, "nextSet"));
  if (!nextSet.ok) return nextSet;
  return ok({ matchId, nextSet: nextSet.value, setNumber, winner });
}

/** Format only: whether the match and the set are open is for the applier, which has the state. */
export function parseServingTeamChangedFields(
  raw: RawObject,
): ParseResult<ServingTeamChangedPayload> {
  const head = readMatchAndSet(raw);
  if (!head.ok) return head;
  const { matchId, setNumber } = head.value;
  const servingTeam = readOwn(raw, "servingTeam");
  if (!isTeamSide(servingTeam)) return invalid("servingTeam");
  const firstServer = readOwn(raw, "firstServer");
  if (!isTeamSide(firstServer)) return invalid("firstServer");
  return ok({ firstServer, matchId, servingTeam, setNumber });
}
