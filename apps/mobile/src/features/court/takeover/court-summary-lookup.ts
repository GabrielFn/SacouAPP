import type { CourtSessionSummary } from "../../../services/api/sacou-api";
import type { CourtAccountRef } from "../ports/court-account";
import type { CourtSessionOrigin } from "../ports/court-event-log";
import type { Scheduler } from "../ports/scheduler";
import type { RoundCourt } from "../session/round-court";
import { takeoverFailureOf } from "./api-calls";
import { readCourtSummary, type CourtSummaryDeps } from "./read-court-summary";
import type { TakeoverFailure } from "./takeover.reducer";

/** What the server says of the court of a round, as a value: the query keeps it, never a throw. */
export type CourtSummaryLookup =
  | { readonly status: "found"; readonly summary: CourtSessionSummary }
  /** 404: the round has no stream yet; the first upload creates it. */
  | { readonly status: "none" }
  | { readonly status: "failed"; readonly reason: TakeoverFailure };

export interface CourtSummaryLookupDeps extends CourtSummaryDeps {
  /** The account signed in now: the summary leaves only with its token (ADR 0067, D8). */
  readonly account: () => Promise<CourtAccountRef | null>;
}

/** The waits of a `Retry-After` on the injected scheduler (ADR 0062), never a global timer. */
export function waitOn(scheduler: Scheduler): (ms: number) => Promise<void> {
  return (ms) =>
    new Promise<void>((resolve) => {
      scheduler.after(ms, resolve);
    });
}

export async function lookUpCourtSummary(
  deps: CourtSummaryLookupDeps,
  origin: CourtSessionOrigin,
): Promise<CourtSummaryLookup> {
  const account = await deps.account();
  if (account === null) return { status: "failed", reason: "no-account" };
  const read = await readCourtSummary(deps, { ...origin, account: account.session });
  if (read.ok) return { status: "found", summary: read.value };
  const reason = takeoverFailureOf(read.error);
  return reason === "not-found" ? { status: "none" } : { status: "failed", reason };
}

/**
 * Whether opening the court of the round goes through screen 09a first (D5, case a): the server has a
 * stream, and this phone does not write it (no session with that ID, or another batch writes it now).
 * A session taken over whose refused points were not seen opens the court: the 09c comes first (D6).
 * Without an answer (offline, still reading) or with no stream, the court opens as before.
 */
export function opensTakeover(
  lookup: CourtSummaryLookup | undefined,
  local: RoundCourt | null,
): boolean {
  if (lookup?.status !== "found") return false;
  if (local?.courtSessionId !== lookup.summary.courtSessionId) return true;
  if (local.takenOver) return !local.refusedUnseen;
  return local.batch !== lookup.summary.currentBatch;
}
