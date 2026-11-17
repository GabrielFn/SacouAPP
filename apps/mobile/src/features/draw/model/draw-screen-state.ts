import type { GroupSettings } from "@sacou/match-engine";

import { apiErrorOf } from "../../../services/api/api-error";
import type { GroupRole, Round } from "../../../services/api/sacou-api";
import type { DrawArrangement } from "./draw-arrangement";
import { MIN_DRAW_PLAYERS } from "./draw-limits";
import { canDraw } from "./can-draw";

/** What stops a draw before asking, or what the server said stops it (D4). */
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

/** Checked before asking, from what the cache has: the role, the round and its resolved settings. */
export function drawBlocker(
  role: GroupRole,
  round: Pick<Round, "status" | "goingCount">,
  settings: GroupSettings,
): DrawBlocker | null {
  if (!canDraw(role)) return "forbidden";
  if (round.status === "canceled") return "canceled";
  if (!settings.draw.enabled) return "disabled";
  return round.goingCount < MIN_DRAW_PLAYERS ? "not-enough" : null;
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
  | { readonly kind: "drawn"; readonly arrangement: DrawArrangement };

function blockerOf(input: DrawScreenInput): DrawBlocker | null {
  const fromError = blockerOfError(input.error);
  if (fromError === "forbidden" || input.loaded === null || input.loaded.settings === null) {
    return fromError;
  }
  const { role, round, settings } = input.loaded;
  return drawBlocker(role, round, settings) ?? fromError;
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
  if (input.loaded.settings === null) return { kind: "unreadable" };
  return input.arrangement === null
    ? firstDraw(input)
    : { kind: "drawn", arrangement: input.arrangement };
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
