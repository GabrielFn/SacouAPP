import type { Round } from "../../../services/api/sacou-api";
import { formatTime } from "../../groups/model/schedule-text";
import { hasEnded } from "./round-cards";
import { shareTextOf } from "./create-round.selectors";
import { hasArrived } from "./round-clock";
import { dateLabel } from "./round-dates";
import { isCanceled } from "./round-detail";

/** Whether screen 06 can hand the link of the round on, and which one (R101 item 1). */
export type RoundLinkOffer =
  { readonly kind: "none" } | { readonly kind: "share"; readonly url: string };

const NONE: RoundLinkOffer = { kind: "none" };

/**
 * The link only while the round still takes answers: before `startsAt` (the instant it starts already
 * counts as started), not canceled and not closed. The server sends `shareUrl` only to who manages the
 * rounds (ADR 0070, D1); this function never builds a URL (D9) and screen 26 never calls it.
 */
export function roundLinkOffer(round: Round, now: number): RoundLinkOffer {
  const url = round.shareUrl ?? null;
  if (url === null || url === "") return NONE;
  if (isCanceled(round) || hasEnded(round, now) || hasArrived(round.startsAt, now)) return NONE;
  return { kind: "share", url };
}

/** The WhatsApp message of a round already published: the same text screen 20 hands over (question 45). */
export function roundShareText(groupName: string, round: Round, url: string): string {
  return shareTextOf(
    groupName,
    dateLabel(round.localDate),
    formatTime(round.localTime),
    round.venue,
    round.capacity,
    url,
  );
}
