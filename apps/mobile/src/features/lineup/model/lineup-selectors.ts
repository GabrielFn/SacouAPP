import { getLineupBySlot, LIBERO_SYSTEMS, type MemberId, type TeamSide } from "@sacou/match-engine";
import {
  ROTATION_SLOTS,
  type FormationPhase,
  type FormationSystem,
  type RotationSlot,
} from "@sacou/volley-rules";

import { lineupStrings as texts } from "../../../strings/lineup.pt-BR";
import type { TeamColorName } from "../../../theme/team-colors";
import { misplacedMembers } from "./fix-roles";
import { DIAGRAM_ORDER } from "./lineup.data";
import { courtChips, serverOf, type LineupChip } from "./lineup-court";
import {
  draftsToSave,
  isDraftStale,
  shownAllocation,
  type LineupEditorState,
} from "./lineup-editor.reducer";
import type { LineupDraft } from "./lineup-moves";
import { basesOf, LINEUP_SIDES, type LineupSource, type LineupTeamSource } from "./lineup-source";

const TWO = 2;
/** Between sets nobody serves yet: the court is drawn as if receiving, with no server (D7). */
const BETWEEN_SETS_DRAWING: FormationPhase = "receiving";

export interface LineupTab {
  readonly side: TeamSide;
  readonly label: string;
  readonly color: TeamColorName;
}

export interface Choice<T> {
  readonly value: T;
  readonly label: string;
  readonly checked: boolean;
}

export interface OrderCell {
  readonly slot: RotationSlot;
  readonly name: string;
  readonly isServer: boolean;
}

export interface LiberoRow {
  readonly label: string;
  readonly options: readonly Choice<MemberId | null>[];
  /** Why there is nothing to choose, `null` with options. */
  readonly note: string | null;
}

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

export interface LineupTeamView {
  readonly side: TeamSide;
  readonly name: string;
  readonly color: TeamColorName;
  readonly system: FormationSystem;
  readonly phaseLabel: string;
  /** Over the half court: "No saque", or "Vale para o próximo set." between sets (D7). */
  readonly courtCaption: string;
  /** `null` in the free system: the zone has no number on the screen (D2). */
  readonly rotation: {
    readonly label: string;
    readonly options: readonly Choice<RotationSlot>[];
  } | null;
  readonly chips: readonly LineupChip[];
  /** "Tornar levantador": a member is selected who is not the setter yet, out of the free system. */
  readonly canMakeSetter: boolean;
  readonly warning: string | null;
  readonly stale: boolean;
  readonly order: readonly OrderCell[];
  readonly benchLine: string;
  readonly libero: LiberoRow;
  /** `null` in a match: the bench of a match takes nobody from the queue (R96). */
  readonly benchRow: BenchRow | null;
  readonly serverChange: string | null;
}

export interface LineupView {
  readonly subtitle: string;
  readonly tabs: readonly LineupTab[];
  readonly tab: TeamSide;
  /** `null` for a team without rotation, which only shows `noRotation`. */
  readonly team: LineupTeamView | null;
  readonly noRotation: string | null;
  readonly canSave: boolean;
}

/** "Lia e Ana estão fora de ordem", in the order of the court diagram (D4). */
export function warningText(names: readonly string[]): string | null {
  const [first, second] = names;
  if (first === undefined) return null;
  if (second === undefined) return texts.misplacedOne(first);
  return names.length === TWO
    ? texts.misplacedTwo(first, second)
    : texts.misplacedMany(names.length);
}

function inDiagramOrder(draft: LineupDraft, members: readonly MemberId[]): readonly MemberId[] {
  const bySlot = getLineupBySlot(draft.lineup, draft.setterZone);
  return DIAGRAM_ORDER.flatMap((slot) => {
    const memberId = bySlot[ROTATION_SLOTS.indexOf(slot)];
    return memberId !== undefined && members.includes(memberId) ? [memberId] : [];
  });
}

function rotationChoices(draft: LineupDraft, team: string): LineupTeamView["rotation"] {
  if (draft.system === "livre") return null;
  return {
    label: texts.rotationGroup(team),
    options: ROTATION_SLOTS.map((zone) => ({
      value: zone,
      label: String(zone),
      checked: zone === draft.setterZone,
    })),
  };
}

function benchLine(draft: LineupDraft, nameOf: LineupSource["nameOf"]): string {
  const onCourt = draft.lineup.length + (draft.libero === null ? 0 : 1);
  return draft.bench.length === 0
    ? texts.noBench(onCourt)
    : texts.bench(draft.bench.map(nameOf).join(texts.nameSeparator));
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

function benchRow(
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

/** The reserves of the queue (pre-game), or the bench of the draft (match), where a libero goes (D5). */
function liberoPoolOf(draft: LineupDraft, team: LineupTeamSource): readonly MemberId[] {
  return team.base?.liberoExit === "bench" ? draft.bench : team.liberoPool;
}

/**
 * Who cannot be the libero of a team: what the other team has (D5) and, in the pre-game, any bench,
 * since a name is never libero and bench together (R96). In a match the pool is the own bench.
 */
function liberoTaken(
  state: LineupEditorState,
  source: LineupSource,
  team: LineupTeamSource,
): readonly MemberId[] {
  const taken = takenByOther(state, source, team.side);
  if (team.benchPool === null || team.base === null) return taken;
  return [...taken, ...shownAllocation(state, team.base).bench];
}

function liberoRow(
  draft: LineupDraft,
  team: LineupTeamSource,
  taken: readonly MemberId[],
  nameOf: LineupSource["nameOf"],
): LiberoRow {
  const label = texts.liberoGroup(team.name);
  if (!LIBERO_SYSTEMS.includes(draft.system))
    return { label, options: [], note: texts.liberoSystemsOnly };
  const current = draft.libero?.memberId ?? null;
  const pool = liberoPoolOf(draft, team).filter((id) => !taken.includes(id) && id !== current);
  const candidates = current === null ? pool : [current, ...pool];
  if (candidates.length === 0) return { label, options: [], note: team.noLiberoText };
  const options = [null, ...candidates].map((value) => ({
    value,
    label: value === null ? texts.noLibero : nameOf(value),
    checked: value === current,
  }));
  return { label, options, note: null };
}

/** The phase the half court is drawn in: the real one, or receiving between sets (D7). */
function drawnPhase(team: LineupTeamSource): FormationPhase {
  return team.phase ?? BETWEEN_SETS_DRAWING;
}

function phaseLabelOf(team: LineupTeamSource): string {
  if (team.phase === null) return texts.betweenSets;
  return team.phase === "serving" ? texts.serving(team.name) : texts.receiving(team.name);
}

function serverChange(draft: LineupDraft, team: LineupTeamSource, nameOf: LineupSource["nameOf"]) {
  const phase = drawnPhase(team);
  const before = team.base === null ? null : serverOf(team.base.state, phase);
  const now = serverOf(draft, phase);
  return now === null || now === before ? null : texts.newServer(nameOf(now));
}

/** "Ordem oficial" from slot 1 to 6: the libero never enters it (D2). */
function officialOrder(
  draft: LineupDraft,
  team: LineupTeamSource,
  nameOf: LineupSource["nameOf"],
): readonly OrderCell[] {
  const bySlot = getLineupBySlot(draft.lineup, draft.setterZone);
  const server = serverOf(draft, drawnPhase(team));
  return ROTATION_SLOTS.flatMap((slot, index) => {
    const memberId = bySlot[index];
    return memberId === undefined
      ? []
      : [{ slot, name: nameOf(memberId), isServer: memberId === server }];
  });
}

function teamView(
  state: LineupEditorState,
  source: LineupSource,
  team: LineupTeamSource,
): LineupTeamView | null {
  const { base } = team;
  if (base === null) return null;
  const draft = shownAllocation(state, base);
  const misplaced = misplacedMembers(draft, source.positionOf);
  const { nameOf } = source;
  return {
    side: team.side,
    name: team.name,
    color: team.color,
    system: draft.system,
    phaseLabel: phaseLabelOf(team),
    courtCaption: team.phase === null ? texts.nextSet : texts.atServe,
    rotation: rotationChoices(draft, team.name),
    chips: courtChips({
      draft,
      phase: drawnPhase(team),
      misplaced,
      selection: state.selection,
      nameOf,
    }),
    canMakeSetter:
      draft.system !== "livre" && state.selection !== null && state.selection !== draft.lineup[0],
    warning: warningText(inDiagramOrder(draft, misplaced).map(nameOf)),
    stale: isDraftStale(state, base),
    order: officialOrder(draft, team, nameOf),
    benchLine: benchLine(draft, nameOf),
    libero: liberoRow(draft, team, liberoTaken(state, source, team), nameOf),
    benchRow: benchRow(draft, benchPoolOf(state, source, team.side), team, nameOf),
    serverChange: serverChange(draft, team, nameOf),
  };
}

/** Everything screen 22 shows, derived from the editor and its host (D2): nothing of it is stored. */
export function lineupView(state: LineupEditorState, source: LineupSource): LineupView {
  const team = source.teams[state.tab];
  return {
    subtitle: source.subtitle,
    tabs: LINEUP_SIDES.map((side) => ({
      side,
      label: source.teams[side].name,
      color: source.teams[side].color,
    })),
    tab: state.tab,
    team: teamView(state, source, team),
    noRotation: team.base === null ? texts.noRotation(team.name, team.size) : null,
    canSave: Object.keys(draftsToSave(state, basesOf(source))).length > 0,
  };
}
