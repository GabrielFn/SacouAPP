import type { GroupSettings, SettingsPath } from "@sacou/match-engine";

/** How one line of screen 18 is drawn and what it writes; the screen only follows this list (D4). */
export type RowSpec =
  | { readonly kind: "switch"; readonly path: SettingsPath }
  /** A switch over a choice of two numbers: on is the second value of the pair. */
  | {
      readonly kind: "margin";
      readonly path: SettingsPath;
      readonly on: number;
      readonly off: number;
    }
  | { readonly kind: "field"; readonly path: SettingsPath }
  | { readonly kind: "schedule" }
  | {
      readonly kind: "choice";
      readonly path: SettingsPath;
      readonly layout: "chips" | "segmented" | "systems";
    }
  | { readonly kind: "queue-rule" };

export interface RowEntry {
  readonly row: RowSpec;
  readonly visibleWhen?: (settings: GroupSettings) => boolean;
}

export type LayoutBlock =
  "attendance" | "scoring" | "queue" | "draw" | "rotation" | "mvp" | "money";

export interface BlockSpec {
  readonly block: LayoutBlock;
  /** An accordion shows a summary and hides its lines until opened. */
  readonly accordion: boolean;
  readonly rows: readonly RowEntry[];
}

const WIN_BY_TWO = 2;
const WIN_BY_ONE = 1;

/**
 * The blocks in the order of the canvas, with "Sorteio" in the same pattern (D4). The money block has no
 * "Forma" nor "Chave" until the Pix of E3.10.
 */
export const SETTINGS_SCREEN: readonly BlockSpec[] = [
  {
    block: "attendance",
    accordion: true,
    rows: [
      { row: { kind: "switch", path: "attendance.capacityLimited" } },
      {
        row: { kind: "field", path: "attendance.capacity" },
        visibleWhen: (s) => s.attendance.capacityLimited,
      },
      { row: { kind: "switch", path: "attendance.waitlistEnabled" } },
      { row: { kind: "switch", path: "attendance.regularsEnabled" } },
      { row: { kind: "switch", path: "attendance.dropInWindowEnabled" } },
      {
        row: { kind: "field", path: "attendance.dropInOpensHoursBefore" },
        visibleWhen: (s) => s.attendance.dropInWindowEnabled,
      },
      { row: { kind: "switch", path: "schedule.enabled" } },
      { row: { kind: "schedule" }, visibleWhen: (s) => s.schedule.enabled },
      { row: { kind: "field", path: "schedule.venue" }, visibleWhen: (s) => s.schedule.enabled },
    ],
  },
  {
    block: "scoring",
    accordion: true,
    rows: [
      { row: { kind: "choice", path: "format.modality", layout: "chips" } },
      { row: { kind: "choice", path: "scoring.bestOf", layout: "segmented" } },
      { row: { kind: "field", path: "scoring.pointsPerSet" } },
      { row: { kind: "switch", path: "scoring.tieBreakEnabled" } },
      {
        row: { kind: "field", path: "scoring.tieBreakPoints" },
        visibleWhen: (s) => s.scoring.tieBreakEnabled,
      },
      { row: { kind: "margin", path: "scoring.winMargin", on: WIN_BY_TWO, off: WIN_BY_ONE } },
    ],
  },
  {
    block: "queue",
    accordion: false,
    rows: [
      { row: { kind: "queue-rule" } },
      { row: { kind: "choice", path: "queue.exitCriterion", layout: "chips" } },
    ],
  },
  {
    block: "draw",
    accordion: false,
    rows: [{ row: { kind: "switch", path: "draw.balanceByLevel" } }],
  },
  {
    block: "rotation",
    accordion: false,
    rows: [
      { row: { kind: "choice", path: "rotation.system", layout: "systems" } },
      { row: { kind: "choice", path: "rotation.ruleMode", layout: "segmented" } },
      { row: { kind: "switch", path: "rotation.liberoEnabled" } },
    ],
  },
  {
    block: "mvp",
    accordion: false,
    rows: [
      { row: { kind: "switch", path: "mvp.byStats" } },
      { row: { kind: "switch", path: "mvp.voting" } },
      { row: { kind: "switch", path: "mvp.individualPoints" } },
    ],
  },
  {
    block: "money",
    accordion: false,
    rows: [
      { row: { kind: "field", path: "money.dropInFeeCents" } },
      { row: { kind: "field", path: "money.monthlyFeeCents" } },
    ],
  },
];

/** The lines of a block that apply to this document (a line depends on the switch above it). */
export function visibleRows(spec: BlockSpec, settings: GroupSettings): readonly RowSpec[] {
  return spec.rows
    .filter(({ visibleWhen }) => visibleWhen === undefined || visibleWhen(settings))
    .map(({ row }) => row);
}
