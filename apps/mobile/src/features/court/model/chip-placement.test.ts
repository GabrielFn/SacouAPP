import { getServeAlignment } from "@sacou/match-engine";
import { FORMATION_SYSTEMS, ROTATION_SLOTS, type FormationPhase } from "@sacou/volley-rules";
import { describe, expect, test } from "vitest";

import { createScaledTokens, shortSide, type ScaledTokens } from "../../../theme/scale";
import { placeChips, type ChipSpec, type Rect } from "./chip-placement";
import type { CourtEnd } from "./court-geometry";
import { computeCourtLayout, type CourtLayout } from "./court-layout";
import type { PlayerChipModel, TeamPanelModel } from "./court-screen.types";
import { layoutTeamChips, placementFrame, type DrawnChip, type TeamChipsInput } from "./team-chips";

type System = (typeof FORMATION_SYSTEMS)[number];

const SHORT_NAMES = ["Bia", "Léo", "Ana", "Lia", "Gabi", "Nina"] as const;
const LONG_NAMES = [
  "Maximiliano",
  "Ana C.",
  "Guilhermina",
  "João P.",
  "Bernardete",
  "Valentina",
] as const;
const SETTER_ZONES = [1, 2, 3, 4, 5, 6] as const;
const PHASES: readonly FormationPhase[] = ["serving", "receiving"];
const LANDSCAPE_ENDS: readonly CourtEnd[] = ["left", "right"];
const PORTRAIT_ENDS: readonly CourtEnd[] = ["top", "bottom"];
const EPSILON = 0.01;

interface Phone {
  readonly width: number;
  readonly height: number;
  readonly insetLeft: number;
}

const LANDSCAPE_PHONES: readonly Phone[] = [
  { width: 640, height: 360, insetLeft: 0 },
  { width: 844, height: 390, insetLeft: 0 },
  { width: 932, height: 430, insetLeft: 0 },
  { width: 844, height: 390, insetLeft: 48 },
];
const PORTRAIT_PHONES: readonly Phone[] = [
  { width: 360, height: 640, insetLeft: 0 },
  { width: 390, height: 844, insetLeft: 0 },
  { width: 430, height: 932, insetLeft: 0 },
];

function layoutOf({ width, height, insetLeft }: Phone): CourtLayout {
  return computeCourtLayout({
    windowWidth: width,
    windowHeight: height,
    insetTop: 0,
    insetBottom: 0,
    insetLeft,
    insetRight: 0,
  });
}

function tokensOf({ width, height }: Phone): ScaledTokens {
  return createScaledTokens({ windowWidth: shortSide(width, height), fontScale: 1 });
}

interface PanelOptions {
  readonly names: readonly string[];
  readonly phase: FormationPhase;
  readonly system: System;
  readonly setterZone: (typeof SETTER_ZONES)[number];
  readonly hasSetPoint: boolean;
}

function panelOf({ names, phase, system, setterZone, hasSetPoint }: PanelOptions): TeamPanelModel {
  const lineup = ["m1", "m2", "m3", "m4", "m5", "m6"];
  const alignment = getServeAlignment({ libero: null, lineup, setterZone, system }, phase);
  const chips = ROTATION_SLOTS.map<PlayerChipModel>((zone, index) => {
    const slot = alignment.slots[zone];
    const name = names[index] ?? "";
    return {
      memberId: slot.memberId,
      name,
      displayName: name,
      zone,
      point: slot.point,
      isServer: phase === "serving" && zone === 1,
      isSetter: slot.memberId === alignment.actingSetter,
      isLibero: false,
    };
  });
  return {
    side: "a",
    label: "Laranja",
    color: "orange",
    score: hasSetPoint ? 24 : 18,
    isServing: phase === "serving",
    rotation: { system, setterZone },
    hasSetPoint,
    serverName: null,
    chips,
  };
}

function boxOf(drawn: DrawnChip, height: number): Rect {
  return {
    left: drawn.x - drawn.width / 2,
    right: drawn.x + drawn.width / 2,
    top: drawn.y - height / 2,
    bottom: drawn.y + height / 2,
  };
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function outside(box: Rect, bounds: Rect): boolean {
  return (
    box.left < bounds.left - EPSILON ||
    box.right > bounds.right + EPSILON ||
    box.top < bounds.top - EPSILON ||
    box.bottom > bounds.bottom + EPSILON
  );
}

function problemsOf(input: TeamChipsInput): readonly string[] {
  const drawn = layoutTeamChips(input);
  const frame = placementFrame(input);
  const boxes = drawn.map((chip) => boxOf(chip, input.tokens.court.sizes.chip));
  return boxes.flatMap((box, index) => {
    const name = drawn[index]?.chip.displayName ?? "";
    const found: string[] = [];
    if (outside(box, frame.bounds)) found.push(`${name} leaves the zone or crosses the net`);
    if (frame.column !== null && overlaps(box, frame.column)) found.push(`${name} covers the column`);
    boxes.slice(index + 1).forEach((other, offset) => {
      if (overlaps(box, other)) {
        found.push(`${name} covers ${drawn[index + 1 + offset]?.chip.displayName ?? ""}`);
      }
    });
    return found;
  });
}

function checkAll(phones: readonly Phone[], ends: readonly CourtEnd[]): readonly string[] {
  const names = [SHORT_NAMES, LONG_NAMES];
  return phones.flatMap((phone) =>
    ends.flatMap((end) =>
      names.flatMap((list) =>
        PHASES.flatMap((phase) =>
          FORMATION_SYSTEMS.flatMap((system) =>
            SETTER_ZONES.flatMap((setterZone) =>
              [false, true].flatMap((hasSetPoint) => {
                const panel = panelOf({ names: list, phase, system, setterZone, hasSetPoint });
                const input = { panel, layout: layoutOf(phone), tokens: tokensOf(phone), end };
                const where = `${String(phone.width)}+${String(phone.insetLeft)} ${end} ${list[0] ?? ""} ${phase} ${system} z${String(setterZone)} sp=${String(hasSetPoint)}`;
                return problemsOf(input).map((problem) => `${where}: ${problem}`);
              }),
            ),
          ),
        ),
      ),
    ),
  );
}

describe("chips of every formation in landscape (both teams, three widths and a notch)", () => {
  test("none covers another, crosses the net, leaves the zone or covers the column", () => {
    expect(checkAll(LANDSCAPE_PHONES, LANDSCAPE_ENDS)).toEqual([]);
  });
});

describe("chips of every formation in the portrait fallback", () => {
  test("none covers another, crosses the net, leaves the zone or covers the column", () => {
    expect(checkAll(PORTRAIT_PHONES, PORTRAIT_ENDS)).toEqual([]);
  });

  test("the chip that was cut at the edge (a receiving team, long names) stays inside the zone", () => {
    const phone = PORTRAIT_PHONES[1] as Phone;
    const panel = panelOf({
      names: LONG_NAMES,
      phase: "receiving",
      system: "5x1",
      setterZone: 1,
      hasSetPoint: false,
    });
    const input = { panel, layout: layoutOf(phone), tokens: tokensOf(phone), end: "bottom" } as const;
    expect(problemsOf(input)).toEqual([]);
  });
});

describe("the server", () => {
  const phone = LANDSCAPE_PHONES[1] as Phone;
  const layout = layoutOf(phone);
  const tokens = tokensOf(phone);

  function serverOf(hasSetPoint: boolean) {
    const panel = panelOf({
      names: SHORT_NAMES,
      phase: "serving",
      system: "5x1",
      setterZone: 1,
      hasSetPoint,
    });
    const input = { panel, layout, tokens, end: "left" } as const;
    const server = layoutTeamChips(input).find(({ chip }) => chip.isServer);
    if (server === undefined) throw new Error("no server");
    return server;
  }

  test("has its center behind the end line when the column leaves the room", () => {
    const server = serverOf(false);
    expect(server.x).toBeLessThan(0);
  });

  test("with a tall column (set point) is pushed in: it is no longer wholly behind the end line", () => {
    const server = serverOf(true);
    expect(server.x + server.width / 2).toBeGreaterThan(0);
  });
});

describe("two chips on the same point and the order of the work", () => {
  const frame = {
    end: "left",
    side: 232,
    bounds: { left: -200, top: -30, right: 232, bottom: 260 },
    column: null,
    gap: 4,
  } as const;
  const twins: readonly ChipSpec[] = [
    { id: "gabi", point: { x: 0.5, y: 0.5 }, halfWidth: 30, halfHeight: 14 },
    { id: "nina", point: { x: 0.5, y: 0.5 }, halfWidth: 30, halfHeight: 14 },
  ];

  test("are pushed apart, and the result is the same however they come in", () => {
    const placed = placeChips(frame, twins);
    const [first, second] = placed.map(({ x, y }) => ({
      left: x - 30,
      right: x + 30,
      top: y - 14,
      bottom: y + 14,
    }));
    expect(first && second && overlaps(first, second)).toBe(false);
    expect(placeChips(frame, [...twins].reverse())).toEqual(placed);
    expect(placeChips(frame, twins)).toEqual(placed);
  });
});
