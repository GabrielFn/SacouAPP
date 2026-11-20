import {
  checkDisplayText,
  resolveSettings,
  SETTINGS_CATALOG,
  type GroupSettings,
  type ResolvedSettings,
  type SettingsLayer,
  type SettingsPath,
  type SettingsValue,
} from "@sacou/match-engine";

import type { CreateRoundBody } from "../../../services/api/sacou-api";
import { roundsStrings } from "../../../strings/rounds.pt-BR";
import { settingsStrings } from "../../../strings/settings.pt-BR";
import { leafLayer } from "../../groups/model/settings-patch";
import type { CreateRoundState, PersonalizePath, RoundLayer } from "./create-round.reducer";
import {
  DEFAULT_ROUND_TIME,
  isBeforeToday,
  isoWeekdayOf,
  isTooFar,
  nextRoundDate,
  parseIsoDate,
  parseTime,
  startOf,
} from "./round-dates";

const { errors } = roundsStrings.create;
const WHOLE_NUMBER = /^\d+$/;

type Entry = readonly [SettingsPath, SettingsValue];

function field(path: SettingsPath) {
  return SETTINGS_CATALOG.fields.find((candidate) => candidate.path === path);
}

/** The venue as it is sent: trimmed and in NFC, the same text the server accepts. */
export function normalizeVenue(text: string): string {
  return text.trim().normalize("NFC");
}

/** The first of the 14 dates the sheet offers: the day the group plays next. */
export function firstRoundDate(group: GroupSettings, now: Date): string {
  const fixedDay = group.schedule.enabled;
  const time = fixedDay ? group.schedule.startTime : DEFAULT_ROUND_TIME;
  return nextRoundDate(now, fixedDay ? group.schedule.weekday : null, time);
}

/** The first state of screen 20, from the group's settings and the clock (never copied again). */
export function initialCreateRoundState(
  group: GroupSettings,
  now: Date,
  hasSeries: boolean,
): CreateRoundState {
  const fixedDay = group.schedule.enabled;
  const capacityShown = group.attendance.enabled && group.attendance.capacityLimited;
  return {
    localDate: firstRoundDate(group, now),
    localTime: fixedDay ? group.schedule.startTime : DEFAULT_ROUND_TIME,
    venue: group.schedule.venue,
    capacityText: capacityShown ? String(group.attendance.capacity) : "",
    layer: {},
    repeatWeekly: fixedDay && !hasSeries,
    personalizeOpen: false,
    sheet: { kind: "none" },
  };
}

export interface CreateRoundErrors {
  readonly date: string | null;
  readonly time: string | null;
  readonly venue: string | null;
  readonly capacity: string | null;
}

function capacityRangeText(): string {
  const capacity = field("attendance.capacity");
  return errors.capacityInvalid(capacity?.min ?? 0, capacity?.max ?? 0);
}

function isCapacityInRange(text: string): boolean {
  const capacity = field("attendance.capacity");
  const value = WHOLE_NUMBER.test(text) ? Number(text) : Number.NaN;
  return (
    Number.isInteger(value) &&
    value >= (capacity?.min ?? 0) &&
    value <= (capacity?.max ?? Number.MAX_SAFE_INTEGER)
  );
}

function capacityError(group: GroupSettings, state: CreateRoundState): string | null {
  const text = state.capacityText.trim();
  if (text === "") return group.attendance.capacityLimited ? capacityRangeText() : null;
  return isCapacityInRange(text) ? null : capacityRangeText();
}

function dateError(now: Date, localDate: string): string | null {
  if (parseIsoDate(localDate) === null || isBeforeToday(now, localDate)) return errors.datePast;
  return isTooFar(now, localDate) ? errors.dateTooFar : null;
}

function timeError(now: Date, state: CreateRoundState, dateFailed: boolean): string | null {
  if (parseTime(state.localTime) === null) return errors.timeInvalid;
  const start = startOf(state.localDate, state.localTime);
  const passed = !dateFailed && start !== null && start.getTime() <= now.getTime();
  return passed ? errors.timePast : null;
}

export function createRoundErrors(
  group: GroupSettings,
  state: CreateRoundState,
  now: Date,
): CreateRoundErrors {
  const date = dateError(now, state.localDate);
  const maxLength = field("schedule.venue")?.maxLength ?? 0;
  return {
    date,
    time: timeError(now, state, date !== null),
    venue:
      checkDisplayText(normalizeVenue(state.venue), maxLength) === null
        ? null
        : errors.venueInvalid,
    capacity: group.attendance.enabled ? capacityError(group, state) : null,
  };
}

export function canPublish(group: GroupSettings, state: CreateRoundState, now: Date): boolean {
  const found = createRoundErrors(group, state, now);
  return (
    found.date === null && found.time === null && found.venue === null && found.capacity === null
  );
}

/** "Publicar" is off while the form is invalid or a call is on the way. */
export function isPublishDisabled(
  group: GroupSettings,
  state: CreateRoundState,
  now: Date,
  pending: boolean,
): boolean {
  return pending || !canPublish(group, state, now);
}

/** How many leaves of the "Personalizar" list differ from the group: the "N mudanças". */
export function layerChangeCount(state: CreateRoundState): number {
  return Object.keys(state.layer).length;
}

/** The capacity leaves the round sets when the field differs from the group; none when it matches. */
function capacityEntries(group: GroupSettings, state: CreateRoundState): readonly Entry[] {
  const text = state.capacityText.trim();
  if (!group.attendance.enabled || text === "") return [];
  const capacity = Number(text);
  const same = group.attendance.capacityLimited && group.attendance.capacity === capacity;
  return same
    ? []
    : [
        ["attendance.capacity", capacity],
        ["attendance.capacityLimited", true],
      ];
}

function layerEntries(layer: RoundLayer): readonly Entry[] {
  return (Object.entries(layer) as [PersonalizePath, SettingsValue][]).map(
    ([path, value]): Entry => [path, value],
  );
}

/** Everything the round changes against the group, or `null` for a round that inherits all. */
export function roundLayerOf(group: GroupSettings, state: CreateRoundState): SettingsLayer | null {
  const entries = [...layerEntries(state.layer), ...capacityEntries(group, state)];
  return entries.length === 0 ? null : leafLayer(entries);
}

export function createRoundRequest(group: GroupSettings, state: CreateRoundState): CreateRoundBody {
  return {
    localDate: state.localDate,
    localTime: state.localTime,
    venue: normalizeVenue(state.venue),
    settings: roundLayerOf(group, state),
    repeatWeekly: state.repeatWeekly,
  };
}

/** The group's settings with the round's layer on top, by the same resolver as the server (for the pills). */
export function resolvedPreview(group: GroupSettings, state: CreateRoundState): ResolvedSettings {
  return resolveSettings(group, roundLayerOf(group, state) ?? undefined);
}

/** "Toda terça, 20h30. Mensalistas já confirmados." */
export function repeatSummary(
  group: GroupSettings,
  state: CreateRoundState,
  formatTime: (time: string) => string,
): string {
  const date = parseIsoDate(state.localDate);
  const every = date === null ? "" : (settingsStrings.weekdays[isoWeekdayOf(date)]?.every ?? "");
  const head = roundsStrings.create.repeatSummary(
    every.charAt(0).toUpperCase() + every.slice(1),
    formatTime(state.localTime),
  );
  return group.attendance.regularsEnabled
    ? `${head} ${roundsStrings.create.regularsConfirmed}`
    : head;
}

/** The value of a personalize leaf as the group has it (for "padrão do grupo: 1 set"). */
export function groupValueOf(group: GroupSettings, path: PersonalizePath): SettingsValue {
  switch (path) {
    case "scoring.bestOf":
      return group.scoring.bestOf;
    case "scoring.pointsPerSet":
      return group.scoring.pointsPerSet;
    case "rotation.system":
      return group.rotation.system;
  }
}

/** Pontos and Rotação only show with their blocks on in the resolved document. */
export function visiblePersonalizePaths(group: GroupSettings): readonly PersonalizePath[] {
  return [
    ...(group.scoring.enabled ? (["scoring.bestOf", "scoring.pointsPerSet"] as const) : []),
    ...(group.rotation.enabled ? (["rotation.system"] as const) : []),
  ];
}

/**
 * The message the WhatsApp share carries (question 45). With the round page's link (`RoundResponse.shareUrl`, only
 * for Admin and Co-admin, ADR 0070, D1) it ends in "Confirma aqui: <url>"; without it, in "Confirma no app Sacou.".
 */
export function shareTextOf(
  groupName: string,
  dateText: string,
  timeText: string,
  venue: string,
  capacity: number | null,
  shareUrl: string | null,
): string {
  const when = `${dateText} · ${timeText}`;
  const place = normalizeVenue(venue);
  const spots = capacity === null ? "" : roundsStrings.share.spots(capacity);
  return shareUrl === null
    ? roundsStrings.share.text(groupName, when, place, spots)
    : roundsStrings.share.textWithLink(groupName, when, place, spots, shareUrl);
}

/** The value of a personalize leaf as text, for the row and for "padrão do grupo: 1 set". */
export function leafText(path: PersonalizePath, value: SettingsValue): string {
  switch (path) {
    case "scoring.bestOf":
      return roundsStrings.setBestOf(Number(value));
    case "scoring.pointsPerSet":
      return String(value);
    case "rotation.system":
      return roundsStrings.chips.rotationSystems[String(value)] ?? String(value);
  }
}
