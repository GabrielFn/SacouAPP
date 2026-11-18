import type { MemberId } from "@sacou/match-engine";
import { teamAverageTenths } from "@sacou/volley-rules";

import { MAX_DRAW_LOCKS } from "./draw-limits";
import { drawStrings } from "../../../strings/draw.pt-BR";
import { formatLevel } from "../../../ui/skill-level";
import { isLocked, type DrawArrangement } from "./draw-arrangement";
import type { DrawFlowState } from "./draw-flow.reducer";
import type { DrawNameOf } from "./draw-names";
import type { DrawNotice } from "./player-tap";
import { teamIdentity, type TeamIdentity } from "./team-identity";

/** "2 times de 6 + 2 reservas": the size of the first team, which the draw keeps equal for all. */
export function drawTitle(arrangement: DrawArrangement): string {
  const perTeam = arrangement.teams[0]?.length ?? 0;
  return drawStrings.title(arrangement.teams.length, perTeam, arrangement.reserves.length);
}

/** One name of the grid or of the queue, as drawn. */
export interface PlayerChipView {
  readonly memberId: MemberId;
  readonly label: string;
  readonly level: string;
  readonly locked: boolean;
  readonly selected: boolean;
  readonly accessibilityLabel: string;
}

export interface TeamCardView {
  readonly team: TeamIdentity;
  /** "nota 3,7". */
  readonly level: string;
  readonly players: readonly PlayerChipView[];
}

interface ChipInput {
  readonly state: DrawFlowState;
  readonly arrangement: DrawArrangement;
}

function chipOf(
  { state, arrangement }: ChipInput,
  memberId: MemberId,
  label: string,
): PlayerChipView {
  const tenths = arrangement.levels.get(memberId);
  // "Montar times" has no level: the name goes alone (question 72).
  const level = tenths === undefined ? "" : formatLevel(tenths);
  const locked = isLocked(state.locks, memberId);
  const lockedSuffix = locked ? drawStrings.player.lockedSuffix : "";
  const spoken = level === "" ? label : drawStrings.player.accessibility(label, level);
  return {
    memberId,
    label,
    level,
    locked,
    selected: state.selection === memberId,
    accessibilityLabel: `${spoken}${lockedSuffix}`,
  };
}

function teamLevel(arrangement: DrawArrangement, members: readonly MemberId[]): string {
  const levels = members.flatMap((id) => {
    const tenths = arrangement.levels.get(id);
    return tenths === undefined ? [] : [tenths];
  });
  if (levels.length < members.length) return "";
  const average = teamAverageTenths(levels);
  return average.ok ? drawStrings.teamLevel(formatLevel(average.value)) : "";
}

export function teamCards(
  state: DrawFlowState,
  arrangement: DrawArrangement,
  nameOf: DrawNameOf,
): readonly TeamCardView[] {
  const input = { state, arrangement };
  return arrangement.teams.map((members, index) => ({
    team: teamIdentity(index),
    level: teamLevel(arrangement, members),
    players: members.map((memberId) => chipOf(input, memberId, nameOf(memberId))),
  }));
}

/** "1 · Davi", in the order of the queue; empty without reserves (the row hides). */
export function reserveChips(
  state: DrawFlowState,
  arrangement: DrawArrangement,
  nameOf: DrawNameOf,
): readonly PlayerChipView[] {
  const input = { state, arrangement };
  return arrangement.reserves.map((memberId, index) =>
    chipOf(input, memberId, drawStrings.reserve(index + 1, nameOf(memberId))),
  );
}

/** The line over the footer buttons: what the next tap does. */
export function footerHint(state: DrawFlowState, nameOf: DrawNameOf): string {
  const { hint } = drawStrings;
  if (state.selection === null) return state.mode === "swap" ? hint.swap : hint.lock;
  const name = nameOf(state.selection);
  return state.mode === "swap" ? hint.swapSelected(name) : hint.lockSelected(name);
}

export function noticeText(notice: DrawNotice | null, nameOf: DrawNameOf): string | null {
  if (notice === null) return null;
  switch (notice.kind) {
    case "lock-broken":
      return drawStrings.notice.lockBroken(nameOf(notice.lock.first), nameOf(notice.lock.second));
    case "reserve-cannot-lock":
      return drawStrings.notice.reserveCannotLock;
    case "too-many-locks":
      return drawStrings.notice.tooManyLocks(MAX_DRAW_LOCKS);
    case "offline":
      return drawStrings.notice.offline;
  }
}

/** "Travar dupla" becomes "Destravar" while a locked member is selected (D3). */
export function lockButton(state: DrawFlowState): "lock" | "unlock" {
  return state.selection !== null && isLocked(state.locks, state.selection) ? "unlock" : "lock";
}
