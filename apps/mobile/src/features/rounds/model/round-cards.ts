import type { MyGroup, RoundSummary } from "../../../services/api/sacou-api";
import { roundsStrings } from "../../../strings/rounds.pt-BR";
import { formatTime } from "../../groups/model/schedule-text";
import { dateLabel, isoWeekdayOf, parseIsoDate } from "./round-dates";

const { cards } = roundsStrings;

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const SUMMARY_WINDOW_HOURS = 24;
/** The home offers "Ver resumo" until 24 h after the real end of the round (`endsAt`, a early `close` included): the window of the votation (question 153). */
export const SUMMARY_CARD_WINDOW_MS = SUMMARY_WINDOW_HOURS * HOUR_MS;

/** The round a group card shows: the first scheduled one that has not started yet. */
export function nextRoundOf(rounds: readonly RoundSummary[], now: number): RoundSummary | null {
  const upcoming = rounds
    .filter((round) => round.status === "scheduled" && Date.parse(round.startsAt) > now)
    .sort((first, second) => Date.parse(first.startsAt) - Date.parse(second.startsAt));
  return upcoming[0] ?? null;
}

/** Whether a scheduled round is being played now: from its start, until its real end (`endsAt`, a early close included). */
export function isLive(round: RoundSummary, now: number): boolean {
  return (
    round.status === "scheduled" &&
    Date.parse(round.startsAt) <= now &&
    now < Date.parse(round.endsAt)
  );
}

/**
 * The round "rolando agora" (R97, D3): the latest scheduled one between its `startsAt` and its `endsAt`.
 * Its card opens screen 06, where the admin draws again or opens the court. A canceled one never.
 */
export function liveRoundOf(rounds: readonly RoundSummary[], now: number): RoundSummary | null {
  const live = rounds
    .filter((round) => isLive(round, now))
    .sort((first, second) => Date.parse(second.startsAt) - Date.parse(first.startsAt));
  return live[0] ?? null;
}

/**
 * The round the home offers "Ver resumo" for: the latest scheduled one that has ended (`endsAt`) and is
 * still inside its window (its `endsAt` plus 24 h). A canceled round never; one being played is "live".
 */
export function recentRoundOf(rounds: readonly RoundSummary[], now: number): RoundSummary | null {
  const recent = rounds
    .filter((round) => {
      const end = Date.parse(round.endsAt);
      return round.status === "scheduled" && end <= now && now < end + SUMMARY_CARD_WINDOW_MS;
    })
    .sort((first, second) => Date.parse(second.startsAt) - Date.parse(first.startsAt));
  return recent[0] ?? null;
}

/** The home looks this many days ahead (R98 part 3: a sliding window, not the calendar week). */
export const HOME_WINDOW_DAYS = 7;

/** The end of the home window: `HOME_WINDOW_DAYS` days after `now`. */
function endOfWindow(now: number): number {
  return now + HOME_WINDOW_DAYS * DAY_MS;
}

/**
 * Every scheduled round that starts within the next 7 days, the soonest first; with none,
 * the next one (so a group that plays only next week still shows up). R97 part 2, D6.
 */
export function upcomingRoundsOf(
  rounds: readonly RoundSummary[],
  now: number,
): readonly RoundSummary[] {
  const limit = endOfWindow(now);
  const thisWeek = rounds
    .filter((round) => {
      const start = Date.parse(round.startsAt);
      return round.status === "scheduled" && start > now && start <= limit;
    })
    .sort((first, second) => Date.parse(first.startsAt) - Date.parse(second.startsAt));
  if (thisWeek.length > 0) return thisWeek;
  const next = nextRoundOf(rounds, now);
  return next === null ? [] : [next];
}

/** How many scheduled rounds, of all the groups, start within the next 7 days. */
export function roundsThisWeek(roundsByGroup: readonly (readonly RoundSummary[])[], now: number) {
  const limit = endOfWindow(now);
  return roundsByGroup.flat().filter((round) => {
    const start = Date.parse(round.startsAt);
    return round.status === "scheduled" && start > now && start <= limit;
  }).length;
}

/** "2 rodadas nos próximos 7 dias.", or `null` with none (the home then speaks with its empty state). */
export function weekSummaryText(count: number): string | null {
  if (count === 0) return null;
  return count === 1 ? cards.oneThisWeek : cards.manyThisWeek(count);
}

export interface GroupWithNextRound {
  readonly group: MyGroup;
  readonly next: RoundSummary | null;
}

/** Groups by their next round, the soonest first; groups without one keep their order at the end. */
export function orderByNextRound<T extends GroupWithNextRound>(
  entries: readonly T[],
): readonly T[] {
  const startOf = (entry: T) =>
    entry.next === null ? Number.POSITIVE_INFINITY : Date.parse(entry.next.startsAt);
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((first, second) => {
      const gap = startOf(first.entry) - startOf(second.entry);
      return gap === 0 || Number.isNaN(gap) ? first.index - second.index : gap;
    })
    .map(({ entry }) => entry);
}

/** The pill styles of `ui/StatusPill` a card uses. */
export type CardPillKind = "confirmed" | "waiting" | "going";

export interface CardPill {
  readonly kind: CardPillKind;
  readonly label: string;
}

function isFull(round: RoundSummary): boolean {
  return round.capacity !== null && round.goingCount >= round.capacity;
}

/**
 * "Vou" with you in a place, "Na espera · 2º" in the waitlist, "Lista cheia" when the list is full and
 * you are not in it, and nothing otherwise (Grupos.dc.html and Inicio.dc.html).
 */
export function cardPill(round: RoundSummary): CardPill | null {
  const { status, position } = round.me;
  if (status === "going" || status === "promoted") return { kind: "confirmed", label: cards.going };
  if (status === "waitlisted") return { kind: "waiting", label: cards.waiting(position) };
  return isFull(round) ? { kind: "going", label: cards.full } : null;
}

/** "9/12 confirmados", "14/14 · 2 na espera" or "9 confirmados" without a limit. */
export function cardCountText(round: RoundSummary): string {
  const going = String(round.goingCount);
  const amount = round.capacity ?? round.goingCount;
  if (round.capacity === null) return cards.confirmed(going, amount);
  const count = `${going}/${String(round.capacity)}`;
  return round.waitlistCount > 0
    ? cards.withWaitlist(count, round.waitlistCount)
    : cards.confirmed(count, amount);
}

/** The day strip: "Ter" and "20h30", in the group's own local date and time. */
export interface DayStripText {
  readonly day: string;
  readonly hour: string;
}

export function dayStripText(round: RoundSummary): DayStripText {
  const date = parseIsoDate(round.localDate);
  const day = date === null ? "" : (roundsStrings.weekdayShort[isoWeekdayOf(date)] ?? "");
  return { day, hour: formatTime(round.localTime) };
}

/** "Rodada de ter, 3/11": the card that offers "Ver resumo". */
export function recentRoundText(round: RoundSummary): string {
  return cards.recent(dateLabel(round.localDate).toLowerCase());
}

/** "Próxima: ter, 3/11". */
export function nextRoundText(round: RoundSummary): string {
  return cards.next(dateLabel(round.localDate).toLowerCase());
}

/** A stable index in a palette of `size` colors, from the `groupId`: the same group keeps its color. */
export function swatchIndexOf(groupId: string, size: number): number {
  if (size === 0) return 0;
  // A UUID is ASCII: its code units are its characters.
  const sum = Array.from({ length: groupId.length }, (_, index) =>
    groupId.charCodeAt(index),
  ).reduce((total, code) => total + code, 0);
  return sum % size;
}

/** Which round a card shows: being played now, the next one, or one that took place (R97, D3). */
export type RoundCardKind = "live" | "next" | "recent";

/** What a card shows of its round; the screens add the group's own parts (name, role). */
export interface RoundCardModel {
  readonly kind: RoundCardKind;
  readonly groupId: string;
  readonly roundId: string;
  /** The start in epoch milliseconds, to order the cards of different groups. */
  readonly startsAt: number;
  readonly strip: DayStripText;
  readonly venue: string;
  readonly nextText: string;
  readonly recentText: string;
  readonly pill: CardPill | null;
  readonly countText: string;
}

export function roundCardModel(
  groupId: string,
  round: RoundSummary,
  kind: RoundCardKind = "next",
): RoundCardModel {
  return {
    kind,
    groupId,
    roundId: round.roundId,
    startsAt: Date.parse(round.startsAt),
    strip: dayStripText(round),
    venue: round.venue,
    nextText: kind === "live" ? cards.live : nextRoundText(round),
    recentText: recentRoundText(round),
    pill: cardPill(round),
    countText: cardCountText(round),
  };
}

export interface GroupRoundCard {
  readonly group: MyGroup;
  readonly round: RoundCardModel | null;
  /** Every round of the week (or the next one, with none), the soonest first: the home shows one card each. */
  readonly upcoming: readonly RoundCardModel[];
  /** The round being played now, that opens screen 06 (R97, D3), or `null`. */
  readonly live: RoundCardModel | null;
  /** The round that offers "Ver resumo" (question 153), or `null`. */
  readonly recent: RoundCardModel | null;
  /** Whether the group has a next round; `null` while its rounds are loading or failed (unknown). */
  readonly hasNextRound: boolean | null;
}

export interface RoundCards {
  /** Every group, the soonest next round first and the groups without one at the end. */
  readonly groups: readonly GroupRoundCard[];
  readonly weekText: string | null;
}

/** `lists[i]` holds the rounds of `groups[i]`, or `undefined` while they load or after a failure. */
export function roundCardsOf(
  groups: readonly MyGroup[],
  lists: readonly (readonly RoundSummary[] | undefined)[],
  now: number,
): RoundCards {
  const entries = groups.map((group, index) => {
    const list = lists[index];
    return {
      group,
      next: nextRoundOf(list ?? [], now),
      live: liveRoundOf(list ?? [], now),
      upcoming: upcomingRoundsOf(list ?? [], now),
      recent: recentRoundOf(list ?? [], now),
      known: list !== undefined,
    };
  });
  return {
    groups: orderByNextRound(entries).map(({ group, next, live, recent, upcoming, known }) => ({
      group,
      round: next === null ? null : roundCardModel(group.groupId, next),
      upcoming: upcoming.map((item) => roundCardModel(group.groupId, item)),
      live: live === null ? null : roundCardModel(group.groupId, live, "live"),
      recent: recent === null ? null : roundCardModel(group.groupId, recent, "recent"),
      hasNextRound: known ? next !== null : null,
    })),
    weekText: weekSummaryText(
      roundsThisWeek(
        lists.map((list) => list ?? []),
        now,
      ),
    ),
  };
}
