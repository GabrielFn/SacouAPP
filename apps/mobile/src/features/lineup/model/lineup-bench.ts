import type { MemberId, TeamSide } from "@sacou/match-engine";

import { lineupStrings as texts } from "../../../strings/lineup.pt-BR";
import { shownAllocation, type LineupEditorState } from "./lineup-editor.reducer";
import type { LineupDraft } from "./lineup-moves";
import type { LineupSource, LineupTeamSource } from "./lineup-source";

export interface BenchOption {
  readonly memberId: MemberId;
  readonly name: string;
  readonly checked: boolean;
}

/** The row "Banco do {time}" of the pre-game (R96): the reserves who can wait on the bench. */
export interface BenchRow {
  readonly label: string;
  readonly options: readonly BenchOption[];
  /** Why there is nobody to put on the bench, `null` with options. */
  readonly note: string | null;
}

/** What the other team shows now (draft or base), `null` when it has no rotation. */
function otherDraft(state: LineupEditorState, source: LineupSource, side: TeamSide) {
  const other = source.teams[side === "a" ? "b" : "a"].base;
  return other === null ? null : shownAllocation(state, other);
}

/** Who the other team already has as libero or on the bench: never on both teams (D5, R96). */
function takenByOther(
  state: LineupEditorState,
  source: LineupSource,
  side: TeamSide,
): readonly MemberId[] {
  const other = otherDraft(state, source, side);
  return other === null ? [] : [...(other.libero ? [other.libero.memberId] : []), ...other.bench];
}

/**
 * Who can go to the bench of a team in the pre-game: the reserves, but not its libero nor what the
 * other team has. `null` in a match (R96).
 */
export function benchPoolOf(
  state: LineupEditorState,
  source: LineupSource,
  side: TeamSide,
): readonly MemberId[] | null {
  const team = source.teams[side];
  if (team.base === null || team.benchPool === null) return null;
  const own = shownAllocation(state, team.base).libero?.memberId ?? null;
  const taken = takenByOther(state, source, side);
  return team.benchPool.filter((id) => id !== own && !taken.includes(id));
}

/** The row "Banco do {time}": `null` in a match, where nobody comes from the queue (R96). */
export function benchRow(
  draft: LineupDraft,
  pool: readonly MemberId[] | null,
  team: LineupTeamSource,
  nameOf: LineupSource["nameOf"],
): BenchRow | null {
  if (pool === null) return null;
  const label = texts.benchGroup(team.name);
  if (pool.length === 0) return { label, options: [], note: texts.noReservesForBench };
  const options = pool.map((memberId) => ({
    memberId,
    name: nameOf(memberId),
    checked: draft.bench.includes(memberId),
  }));
  return { label, options, note: null };
}

/**
 * Who cannot be the libero of a team: what the other team has (D5) and, in the pre-game, any bench,
 * since a name is never libero and bench together (R96). In a match the pool is the own bench.
 */
export function liberoTaken(
  state: LineupEditorState,
  source: LineupSource,
  team: LineupTeamSource,
): readonly MemberId[] {
  const taken = takenByOther(state, source, team.side);
  if (team.benchPool === null || team.base === null) return taken;
  return [...taken, ...shownAllocation(state, team.base).bench];
}
