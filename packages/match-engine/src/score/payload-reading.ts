import {
  err,
  FORMATION_SYSTEMS,
  type FormationSystem,
  type Result,
  type SetterZone,
} from "@sacou/volley-rules";

import { isUuid } from "../event-log/is-uuid.js";
import {
  FIRST_SET_NUMBER,
  LAST_SET_NUMBER,
  MAX_SET_POINTS,
  MAX_TEAM_MEMBERS,
  MIN_SET_POINTS,
  MIN_TEAM_MEMBERS,
  SETTER_ZONE_SEQUENCE,
  TEAM_SIDES,
} from "./constants.data.js";
import type {
  MemberId,
  PayloadShape,
  ScorePayloadError,
  ScorePayloadField,
  TeamSide,
} from "./types.js";

export type RawObject = Readonly<Record<string, unknown>>;
export type ParseResult<T> = Result<T, ScorePayloadError>;
export type PayloadParser<T> = (raw: unknown) => ParseResult<T>;

export function invalid(field: ScorePayloadField): Result<never, ScorePayloadError> {
  return err({ code: "invalid-payload", field });
}

export function isPlainObject(value: unknown): value is RawObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
}

export function isOneOf<T>(allowed: readonly T[], value: unknown): value is T {
  return (allowed as readonly unknown[]).includes(value);
}

export function isSetPoints(value: unknown): value is number {
  return isIntegerInRange(value, MIN_SET_POINTS, MAX_SET_POINTS);
}

export function isSetNumber(value: unknown): value is number {
  return isIntegerInRange(value, FIRST_SET_NUMBER, LAST_SET_NUMBER);
}

export function isTeamSide(value: unknown): value is TeamSide {
  return isOneOf(TEAM_SIDES, value);
}

export function isSetterZone(value: unknown): value is SetterZone {
  return isOneOf(SETTER_ZONE_SEQUENCE, value);
}

export function isFormationSystem(value: unknown): value is FormationSystem {
  return isOneOf(FORMATION_SYSTEMS, value);
}

export function isVersion(value: unknown): value is number {
  return isIntegerInRange(value, 1, Number.MAX_SAFE_INTEGER);
}

/** Own properties only: with a polluted Object.prototype, a missing field must stay missing. */
export function readOwn(raw: RawObject, field: string): unknown {
  return Object.hasOwn(raw, field) ? raw[field] : undefined;
}

/**
 * UUIDs, each one once, or `null`. The copy turns holes of a sparse array into undefined, which
 * fails the UUID check.
 */
export function readUniqueMemberIds(raw: readonly unknown[]): readonly MemberId[] | null {
  const items: readonly unknown[] = Array.from(raw);
  const memberIds = items.filter(isUuid);
  const isValid = memberIds.length === items.length && new Set(memberIds).size === items.length;
  return isValid ? memberIds : null;
}

export function parseUniqueMemberIds(
  raw: unknown,
  min: number,
  max: number,
): readonly MemberId[] | null {
  if (!Array.isArray(raw) || !isIntegerInRange(raw.length, min, max)) {
    return null;
  }
  return readUniqueMemberIds(raw as readonly unknown[]);
}

export function parseMemberIds(raw: unknown): readonly MemberId[] | null {
  return parseUniqueMemberIds(raw, MIN_TEAM_MEMBERS, MAX_TEAM_MEMBERS);
}

type ChildShape = PayloadShape[string];

/** A child of the wrong type has no keys to report: its own field check rejects it. */
function hasUnknownChildKey(child: unknown, childShape: ChildShape | undefined): boolean {
  if (childShape === null || childShape === undefined) {
    return false;
  }
  if (isPayloadListShape(childShape)) {
    const [itemShape] = childShape;
    return (
      Array.isArray(child) &&
      (child as readonly unknown[]).some(
        (item) => isPlainObject(item) && hasUnknownKey(item, itemShape),
      )
    );
  }
  return isPlainObject(child) && hasUnknownKey(child, childShape);
}

function isPayloadListShape(
  shape: PayloadShape | readonly [PayloadShape],
): shape is readonly [PayloadShape] {
  return Array.isArray(shape);
}

export function hasUnknownKey(raw: RawObject, shape: PayloadShape): boolean {
  return Reflect.ownKeys(raw).some(
    (key) =>
      typeof key !== "string" ||
      !Object.hasOwn(shape, key) ||
      hasUnknownChildKey(raw[key], shape[key]),
  );
}
