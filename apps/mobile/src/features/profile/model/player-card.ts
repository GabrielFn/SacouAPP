import type { MyStats, MyStatsTotals, PlayingPosition } from "../../../services/api/sacou-api";
import { strings } from "../../../strings/pt-BR";
import { initialsOfName } from "../../../ui/initials";
import type { StoredProfile } from "./profile-stub";

const { card, stats: tileTexts } = strings.profile;
const { positions } = strings.ratings;

const PERCENT = 100;
const HALF = 2;
const MINUS_SIGN = "−";

/** The six numbers of the card, in the order of the drawing. A closed list: there is no level nor tier (ADR 0047). */
export const CARD_STAT_KEYS = [
  "matches",
  "winRate",
  "plusMinus",
  "longestStreak",
  "mvpCount",
  "presence",
] as const;
export type CardStatKey = (typeof CARD_STAT_KEYS)[number];

export interface CardStat {
  readonly key: CardStatKey;
  readonly value: string;
  readonly label: string;
}

/** The six tiles of screen 14. */
export const TILE_KEYS = [
  "matches",
  "wins",
  "plusMinus",
  "longestStreak",
  "mvpCount",
  "rounds",
] as const;
export type TileKey = (typeof TILE_KEYS)[number];

export interface StatTileModel {
  readonly key: TileKey;
  readonly value: string;
  readonly label: string;
}

/** What the card draws. It carries no level, tier, rating nor any field the API does not send for it. */
export interface PlayerCardModel {
  readonly nickname: string;
  readonly initials: string | null;
  /** "Ponteiro"; `null` without a position. */
  readonly positionLabel: string | null;
  /** "também oposto e central"; `null` without other positions. */
  readonly otherPositionsLabel: string | null;
  /** The six-square glyph is decoration of a concrete position (question 162). */
  readonly showGlyph: boolean;
  readonly seasonLabel: string;
  readonly stats: readonly CardStat[];
}

/** A whole percentage, half up, with integer arithmetic; "—" without a base (never "NaN%" nor "0%"). */
export function formatPercent(part: number, whole: number): string {
  if (whole <= 0) return card.noValue;
  const percent = Math.floor((PERCENT * HALF * part + whole) / (HALF * whole));
  return `${String(percent)}%`;
}

/** "+112", "0" and "−5" (a real minus sign). */
export function formatSigned(value: number): string {
  if (value > 0) return `+${String(value)}`;
  return value < 0 ? `${MINUS_SIGN}${String(Math.abs(value))}` : String(value);
}

function lowerPosition(position: PlayingPosition): string {
  return positions[position].toLocaleLowerCase("pt-BR");
}

/** "oposto", "oposto e central", "oposto, central e líbero". */
function joinPositions(labels: readonly string[]): string {
  const last = labels[labels.length - 1];
  if (labels.length < HALF || last === undefined) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} e ${last}`;
}

export function positionLabelOf(profile: StoredProfile): string | null {
  if (!("primaryPosition" in profile) || profile.primaryPosition === null) return null;
  return positions[profile.primaryPosition];
}

export function otherPositionsLabelOf(profile: StoredProfile): string | null {
  if (!("otherPositions" in profile) || profile.otherPositions.length === 0) return null;
  return card.alsoPlays(joinPositions(profile.otherPositions.map(lowerPosition)));
}

/** "Ponteiro · também oposto", the line under the name on screen 14. */
export function positionLineOf(profile: StoredProfile): string | null {
  const parts = [positionLabelOf(profile), otherPositionsLabelOf(profile)].filter(
    (part) => part !== null,
  );
  return parts.length === 0 ? null : parts.join(" · ");
}

function showsGlyph(profile: StoredProfile): boolean {
  return (
    "primaryPosition" in profile &&
    profile.primaryPosition !== null &&
    profile.primaryPosition !== "any"
  );
}

/** The numbers of the card; the presence is rounds played over rounds held (question 99). */
export function cardStatsOf(totals: MyStatsTotals): readonly CardStat[] {
  return [
    { key: "matches", value: String(totals.matchesPlayed), label: card.matches },
    {
      key: "winRate",
      value: formatPercent(totals.wins, totals.matchesPlayed),
      label: card.winRate,
    },
    { key: "plusMinus", value: formatSigned(totals.plusMinus), label: card.plusMinus },
    { key: "longestStreak", value: String(totals.longestWinStreak), label: card.longestStreak },
    { key: "mvpCount", value: String(totals.mvpCount), label: card.mvpCount },
    {
      key: "presence",
      value: formatPercent(totals.rounds, totals.roundsHeld),
      label: card.presence,
    },
  ];
}

/** The tiles of "Estatísticas" (also used per group by the caller with that group's totals). */
export function statTilesOf(totals: MyStatsTotals): readonly StatTileModel[] {
  return [
    { key: "matches", value: String(totals.matchesPlayed), label: tileTexts.matches },
    {
      key: "wins",
      value: String(totals.wins),
      label: tileTexts.wins(formatPercent(totals.wins, totals.matchesPlayed)),
    },
    { key: "plusMinus", value: formatSigned(totals.plusMinus), label: tileTexts.plusMinus },
    {
      key: "longestStreak",
      value: String(totals.longestWinStreak),
      label: tileTexts.longestStreak,
    },
    { key: "mvpCount", value: String(totals.mvpCount), label: tileTexts.mvpCount },
    { key: "rounds", value: String(totals.rounds), label: tileTexts.rounds },
  ];
}

/** Only the named fields of the report are read: whatever else came on the wire stops here. */
export function playerCardOf(profile: StoredProfile, report: MyStats): PlayerCardModel {
  return {
    nickname: profile.nickname,
    initials: initialsOfName(profile.nickname),
    positionLabel: positionLabelOf(profile),
    otherPositionsLabel: otherPositionsLabelOf(profile),
    showGlyph: showsGlyph(profile),
    seasonLabel: card.season(report.year),
    stats: cardStatsOf(report.total),
  };
}

/** What the screen reader says; with the numbers hidden it says none. */
export function cardAccessibilityLabel(model: PlayerCardModel, showStats: boolean): string {
  const numbers = showStats ? model.stats.map(spokenStat) : [];
  return card.label(model.positionLabel, numbers);
}

function spokenStat(stat: CardStat): string {
  return card.summary[stat.key](stat.value);
}
