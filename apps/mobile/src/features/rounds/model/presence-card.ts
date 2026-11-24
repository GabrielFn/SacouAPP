import type { GroupSettings } from "@sacou/match-engine";

import type { MemberType, Round } from "../../../services/api/sacou-api";
import { roundsStrings } from "../../../strings/rounds.pt-BR";
import { hasEnded } from "./round-cards";
import { dropInOpensPhrase, hasArrived } from "./round-clock";
import { isCanceled } from "./round-detail";
import type { RosterEntry } from "./roster";

const { presence } = roundsStrings;

/** What the footer of screen 26 offers; the server decides the place in every case (risk 3). */
export type PresenceActions =
  | { readonly kind: "none" }
  /** "VOU" and "Não vou"; `canGo` is off for a full list without waitlist or a closed window. */
  | {
      readonly kind: "answer";
      readonly canGo: boolean;
      /** Why "VOU" is off while the window of the drop-ins is shut (R101); `null` otherwise. */
      readonly lockedHint: string | null;
    }
  /** "Não vou mais" or "Sair da espera". */
  | {
      readonly kind: "leave";
      readonly label: string;
      /** "Clara (1º da espera) entra no seu lugar.", only for who holds a spot. */
      readonly warning: string | null;
      /** "Não vou mais" always asks first (R101 3b); "Sair da espera" does not take a spot from anyone. */
      readonly needsConfirm: boolean;
      /** What the confirmation says about coming back; `null` when it does not ask. */
      readonly leaveBody: string | null;
    };

export interface PresenceCardView {
  readonly title: string;
  readonly line: string | null;
  readonly actions: PresenceActions;
}

export interface PresenceInput {
  readonly round: Round;
  readonly values: GroupSettings;
  /** The waitlist with names, for the warning under "Não vou mais". */
  readonly waitlist: readonly RosterEntry[];
  /** `null` while the member list is not here: no window is applied, the server decides. */
  readonly myType: MemberType | null;
  /** Some active member is a regular: the line of the window says "só os mensalistas confirmam". */
  readonly groupHasRegulars: boolean;
  /** Hours before the round when the window of the drop-ins opens. */
  readonly dropInHours: number;
  readonly now: number;
}

const NONE: PresenceActions = { kind: "none" };

export function isFull(round: Round): boolean {
  return round.capacity !== null && round.goingCount >= round.capacity;
}

/** `going` and `promoted` hold a spot; `waitlisted` waits for one. */
export function holdsSpot(round: Round): boolean {
  return round.me.status === "going" || round.me.status === "promoted";
}

function titleOf(round: Round): string {
  if (holdsSpot(round)) return presence.going;
  return round.me.status === "waitlisted" ? presence.waitlisted : presence.ask;
}

/** Who never answered has no question to see once the round is over: the title says it ended. */
function endedTitleOf(round: Round): string {
  const answered = holdsSpot(round) || round.me.status === "waitlisted";
  return answered ? titleOf(round) : roundsStrings.detail.ended;
}

function goingLine(round: Round): string | null {
  const { regularPosition, position } = round.me;
  if (regularPosition !== null) return presence.regularPosition(regularPosition);
  return position === null ? null : presence.listPosition(position);
}

function leaveBodyOf(round: Round, waitlist: readonly RosterEntry[]): string {
  if (!isFull(round)) return presence.leaveBodyOpen;
  const first = waitlist[0];
  if (first === undefined) return presence.leaveBodyFull;
  return presence.leaveBodyFullWithWaitlist(first.name ?? roundsStrings.detail.noName);
}

function leaveWarning(waitlist: readonly RosterEntry[]): string | null {
  const first = waitlist[0];
  return first === undefined
    ? null
    : presence.takesYourPlace(first.name ?? roundsStrings.detail.noName);
}

function goingCard(input: PresenceInput): PresenceCardView {
  const { round } = input;
  const waitlist = input.values.attendance.waitlistEnabled ? input.waitlist : [];
  return {
    title: presence.going,
    line: goingLine(round),
    actions: {
      kind: "leave",
      label: presence.notGoingAnymore,
      warning: leaveWarning(waitlist),
      needsConfirm: true,
      leaveBody: leaveBodyOf(round, waitlist),
    },
  };
}

function waitlistedCard(round: Round): PresenceCardView {
  const position = round.me.position;
  return {
    title: presence.waitlisted,
    line: position === null ? null : presence.waitlistPosition(position),
    actions: {
      kind: "leave",
      label: presence.leaveWaitlist,
      warning: null,
      needsConfirm: false,
      leaveBody: null,
    },
  };
}

function spotsLine(round: Round, waitlistEnabled: boolean): string | null {
  if (round.capacity === null) return null;
  if (!isFull(round)) return presence.spotsLeft(round.capacity - round.goingCount);
  return waitlistEnabled ? presence.fullToWaitlist : presence.full;
}

function dropInLine(input: PresenceInput, opensAt: string): string {
  const phrase = dropInOpensPhrase(input.round, opensAt, input.now);
  return input.groupHasRegulars
    ? presence.dropInOpensWithRegulars(phrase)
    : presence.dropInOpensNoRegulars(phrase, input.dropInHours);
}

function answerCard(input: PresenceInput): PresenceCardView {
  const { round, values } = input;
  const opensAt = round.dropInOpensAt;
  if (input.myType === "dropIn" && opensAt !== null && !hasArrived(opensAt, input.now)) {
    return {
      title: presence.ask,
      line: dropInLine(input, opensAt),
      actions: { kind: "answer", canGo: false, lockedHint: presence.dropInLockedHint },
    };
  }
  const waitlistEnabled = values.attendance.waitlistEnabled;
  return {
    title: presence.ask,
    line: spotsLine(round, waitlistEnabled),
    actions: { kind: "answer", canGo: !isFull(round) || waitlistEnabled, lockedHint: null },
  };
}

/** The "Sua presença" card of screen 26, one row of the table of D7 (question 46). */
export function presenceCard(input: PresenceInput): PresenceCardView {
  const { round } = input;
  if (isCanceled(round)) return { title: presence.canceled, line: null, actions: NONE };
  if (hasEnded(round, input.now)) {
    return { title: endedTitleOf(round), line: roundsStrings.detail.ended, actions: NONE };
  }
  if (hasArrived(round.startsAt, input.now)) {
    return { title: titleOf(round), line: presence.started, actions: NONE };
  }
  if (holdsSpot(round)) return goingCard(input);
  if (round.me.status === "waitlisted") return waitlistedCard(round);
  return answerCard(input);
}

export interface PresenceCounts {
  /** "12/12", or "12" without a limit. */
  readonly confirmed: string;
  /** "1 na espera", or `null` with the waitlist off or empty. */
  readonly waitlist: string | null;
}

/** The counts on the right of the card. */
export function presenceCounts(round: Round, values: GroupSettings): PresenceCounts {
  const { detail } = roundsStrings;
  const confirmed =
    round.capacity === null
      ? detail.confirmedCount(round.goingCount)
      : detail.confirmedOf(round.goingCount, round.capacity);
  const showWaitlist = values.attendance.waitlistEnabled && round.waitlistCount > 0;
  return {
    confirmed,
    waitlist: showWaitlist ? presence.waitlistCount(round.waitlistCount) : null,
  };
}
