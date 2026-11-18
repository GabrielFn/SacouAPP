import { getLineupBySlot, LIBERO_SYSTEMS, type MemberId, type TeamSide } from "@sacou/match-engine";
import { ROTATION_SLOTS, type FormationSystem, type RotationSlot } from "@sacou/volley-rules";

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

export interface LineupTeamView {
  readonly side: TeamSide;
  readonly name: string;
  readonly color: TeamColorName;
  readonly system: FormationSystem;
  readonly phaseLabel: string;
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

/** The libero of the other team: the same name is never the libero of both (D5). */
function otherLibero(state: LineupEditorState, source: LineupSource, side: TeamSide) {
  const other = source.teams[side === "a" ? "b" : "a"].base;
  return other === null ? null : (shownAllocation(state, other).libero?.memberId ?? null);
}

function liberoRow(
  draft: LineupDraft,
  team: LineupTeamSource,
  taken: MemberId | null,
  nameOf: LineupSource["nameOf"],
): LiberoRow {
  const label = texts.liberoGroup(team.name);
  if (!LIBERO_SYSTEMS.includes(draft.system))
    return { label, options: [], note: texts.liberoSystemsOnly };
  const current = draft.libero?.memberId ?? null;
  const pool = team.liberoPool.filter((id) => id !== taken && id !== current);
  const candidates = current === null ? pool : [current, ...pool];
  if (candidates.length === 0) return { label, options: [], note: team.noLiberoText };
  const options = [null, ...candidates].map((value) => ({
    value,
    label: value === null ? texts.noLibero : nameOf(value),
    checked: value === current,
  }));
  return { label, options, note: null };
}

function serverChange(draft: LineupDraft, team: LineupTeamSource, nameOf: LineupSource["nameOf"]) {
  const before = team.base === null ? null : serverOf(team.base.state, team.phase);
  const now = serverOf(draft, team.phase);
  return now === null || now === before ? null : texts.newServer(nameOf(now));
}

/** "Ordem oficial" from slot 1 to 6: the libero never enters it (D2). */
function officialOrder(
  draft: LineupDraft,
  team: LineupTeamSource,
  nameOf: LineupSource["nameOf"],
): readonly OrderCell[] {
  const bySlot = getLineupBySlot(draft.lineup, draft.setterZone);
  const server = serverOf(draft, team.phase);
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
    phaseLabel: team.phase === "serving" ? texts.serving(team.name) : texts.receiving(team.name),
    rotation: rotationChoices(draft, team.name),
    chips: courtChips({ draft, phase: team.phase, misplaced, selection: state.selection, nameOf }),
    canMakeSetter:
      draft.system !== "livre" && state.selection !== null && state.selection !== draft.lineup[0],
    warning: warningText(inDiagramOrder(draft, misplaced).map(nameOf)),
    stale: isDraftStale(state, base),
    order: officialOrder(draft, team, nameOf),
    benchLine: benchLine(draft, nameOf),
    libero: liberoRow(draft, team, otherLibero(state, source, team.side), nameOf),
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
