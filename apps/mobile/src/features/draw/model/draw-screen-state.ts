import type { GroupSettings } from "@sacou/match-engine";

import { apiErrorOf } from "../../../services/api/api-error";
import type { GroupRole, Round } from "../../../services/api/sacou-api";
import type { DrawArrangement } from "./draw-arrangement";
import { canDraw } from "./can-draw";
import { MIN_DRAW_PLAYERS } from "./draw-limits";
import { arrivalArrangement } from "./manual-teams";

/**
 * What stops a draw before asking, or what the server said stops it (D4). "disabled" comes only from the
 * server now: with the draw off in the cache, screen 07 builds the teams by hand (question 72).
 */
export type DrawBlocker = "forbidden" | "canceled" | "disabled" | "not-enough";

const FORBIDDEN_STATUS = 403;

const BLOCKING_CODES: Readonly<Record<string, DrawBlocker>> = {
  "sessions.round-closed": "canceled",
  "sessions.draw-disabled": "disabled",
  "sessions.draw-not-enough-players": "not-enough",
};

/** The blocker a refused draw means; `null` for the errors that keep the screen (a lock, the network). */
export function blockerOfError(error: unknown): DrawBlocker | null {
  const apiError = apiErrorOf(error);
  if (apiError?.kind !== "problem") return null;
  if (apiError.status === FORBIDDEN_STATUS) return "forbidden";
  return BLOCKING_CODES[apiError.code] ?? null;
}

/** Checked before asking, from what the cache has: the role and the round. Holds for "Montar times" too. */
export function drawBlocker(
  role: GroupRole,
  round: Pick<Round, "status" | "goingCount">,
): DrawBlocker | null {
  if (!canDraw(role)) return "forbidden";
  if (round.status === "canceled") return "canceled";
  return round.goingCount < MIN_DRAW_PLAYERS ? "not-enough" : null;
}

/** The draw is off in the resolved settings: the teams are built by hand, with no call (question 72). */
export function isManualDraw(settings: GroupSettings): boolean {
  return !settings.draw.enabled;
}

export interface DrawScreenInput {
  /** `undefined` while the group, the round or the members are still loading. */
  readonly loaded: {
    readonly role: GroupRole;
    readonly round: Round;
    /** `null` when the resolved settings do not parse. */
    readonly settings: GroupSettings | null;
  } | null;
  readonly arrangement: DrawArrangement | null;
  readonly pending: boolean;
  readonly error: unknown;
  readonly online: boolean;
}

/** The table D4 of screen 07, one kind per row; the details of "drawn" are derived elsewhere. */
export type DrawScreenState =
  | { readonly kind: "loading" }
  | { readonly kind: "blocked"; readonly blocker: DrawBlocker }
  | { readonly kind: "unreadable" }
  | { readonly kind: "offline" }
  | { readonly kind: "failed"; readonly error: unknown }
  | { readonly kind: "drawing" }
  /** `manual`: built by hand with the draw off, no level and no meter (question 72). */
  | { readonly kind: "drawn"; readonly arrangement: DrawArrangement; readonly manual: boolean };

function blockerOf(input: DrawScreenInput): DrawBlocker | null {
  const fromError = blockerOfError(input.error);
  if (fromError === "forbidden" || input.loaded === null || input.loaded.settings === null) {
    return fromError;
  }
  const { role, round, settings } = input.loaded;
  // Built by hand, nothing is asked: an earlier refusal of the server no longer stops the screen.
  if (isManualDraw(settings)) return drawBlocker(role, round);
  return drawBlocker(role, round) ?? fromError;
}

/** The teams the admin edited, else the ones by arrival, derived from the round as it is now. */
function manualDraw(
  input: DrawScreenInput,
  round: Round,
  settings: GroupSettings,
): DrawScreenState {
  const arrangement = input.arrangement ?? arrivalArrangement(round, settings.format.modality);
  return arrangement === null
    ? { kind: "blocked", blocker: "not-enough" }
    : { kind: "drawn", arrangement, manual: true };
}

function firstDraw(input: DrawScreenInput): DrawScreenState {
  if (input.pending) return { kind: "drawing" };
  const offline = !input.online || apiErrorOf(input.error)?.kind === "offline";
  if (offline) return { kind: "offline" };
  return input.error === null ? { kind: "loading" } : { kind: "failed", error: input.error };
}

export function drawScreenState(input: DrawScreenInput): DrawScreenState {
  const blocker = blockerOf(input);
  if (blocker !== null) return { kind: "blocked", blocker };
  if (input.loaded === null) return { kind: "loading" };
  const { round, settings } = input.loaded;
  if (settings === null) return { kind: "unreadable" };
  if (isManualDraw(settings)) return manualDraw(input, round, settings);
  return input.arrangement === null
    ? firstDraw(input)
    : { kind: "drawn", arrangement: input.arrangement, manual: false };
}

/** The first draw goes once, by itself, when nothing stops it (D4); "Tentar de novo" asks again. */
export function shouldDrawFirst(input: DrawScreenInput): boolean {
  return (
    drawScreenState(input).kind === "loading" &&
    input.loaded !== null &&
    input.error === null &&
    input.online
  );
}
