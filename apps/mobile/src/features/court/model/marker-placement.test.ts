import { getServeAlignment } from "@sacou/match-engine";
import { FORMATION_SYSTEMS, ROTATION_SLOTS, type FormationPhase } from "@sacou/volley-rules";
import { describe, expect, test } from "vitest";

import { createScaledTokens, shortSide, type ScaledTokens } from "../../../theme/scale";
import { MARKER_ZONE_MARGIN } from "../court.data";
import { placeOnHalfCourt, type CourtEnd } from "./court-geometry";
import { computeCourtLayout, type CourtLayout } from "./court-layout";
import type { PlayerChipModel, TeamPanelModel } from "./court-screen.types";
import type { Rect } from "./marker-placement";
import {
  layoutTeamMarkers,
  markerRadius,
  placementFrame,
  squareOrigin,
  type DrawnMarker,
  type TeamMarkersInput,
} from "./team-markers";

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

const PERCENT = 100;
const CROWDED_RADII = 5;

function farFromOthers(first: DrawnMarker, second: DrawnMarker, apart: number): boolean {
  return Math.hypot(first.placed.x - second.placed.x, first.placed.y - second.placed.y) >= apart;
}

/** The radius of the circle with the room of its badges (the ball, the L, the Lí). */
function reachOf({ chip }: DrawnMarker, tokens: ScaledTokens): number {
  const badge = chip.isServer || chip.isSetter || chip.isLibero;
  return markerRadius(tokens) + (badge ? tokens.court.spacing.badgeOffsetX : 0);
}

function circleOf(drawn: DrawnMarker, tokens: ScaledTokens): Rect {
  const reach = reachOf(drawn, tokens);
  return {
    left: drawn.placed.x - reach,
    right: drawn.placed.x + reach,
    top: drawn.placed.y - reach,
    bottom: drawn.placed.y + reach,
  };
}

function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.left < b.right - EPSILON &&
    a.right > b.left + EPSILON &&
    a.top < b.bottom - EPSILON &&
    a.bottom > b.top + EPSILON
  );
}

function within(box: Rect, bounds: Rect): boolean {
  return (
    box.left >= bounds.left - EPSILON &&
    box.right <= bounds.right + EPSILON &&
    box.top >= bounds.top - EPSILON &&
    box.bottom <= bounds.bottom + EPSILON
  );
}

/** What is wrong with the markers of one team: nothing, when every rule holds. */
function problemsOf(input: TeamMarkersInput): readonly string[] {
  const drawn = layoutTeamMarkers(input);
  const frame = placementFrame(input);
  return drawn.flatMap((marker, index) => {
    const radius = reachOf(marker, input.tokens);
    const who = marker.chip.displayName;
    const found: string[] = [];
    const circle = circleOf(marker, input.tokens);
    const wanted = placeOnHalfCourt(marker.chip.point, input.end);
    const x = (wanted.x / PERCENT) * frame.side;
    const y = (wanted.y / PERCENT) * frame.side;
    const wantedBox = { left: x - radius, right: x + radius, top: y - radius, bottom: y + radius };
    const insideZone =
      within(wantedBox, frame.bounds) &&
      (frame.column === null || !overlaps(wantedBox, frame.column));
    const moved =
      Math.abs(marker.placed.x - x) > EPSILON || Math.abs(marker.placed.y - y) > EPSILON;
    if (insideZone && moved) found.push(`${who}: the circle is not on the point of the formation`);
    if (!within(circle, frame.bounds)) found.push(`${who}: the circle leaves the zone`);
    if (frame.column !== null && overlaps(circle, frame.column)) {
      found.push(`${who}: the circle covers the column`);
    }
    const name = marker.placed.name.box;
    const side = marker.placed.name.side;
    if (marker.placed.name.text === "") found.push(`${who}: the name is missing`);
    if (!within(name, frame.bounds)) found.push(`${who}: the name leaves the zone`);
    if (frame.column !== null && overlaps(name, frame.column)) {
      found.push(`${who}: the name covers the column`);
    }
    const center = (name.left + name.right) / 2;
    const edges = [frame.bounds.left, frame.bounds.right, frame.column?.left, frame.column?.right];
    const clamped = edges.some(
      (edge) =>
        edge !== undefined &&
        (Math.abs(name.left - edge) < EPSILON || Math.abs(name.right - edge) < EPSILON),
    );
    if (!clamped && Math.abs(center - marker.placed.x) > EPSILON) {
      found.push(`${who}: the name is not centered under its circle`);
    }
    const fitsBelow =
      circle.bottom + input.tokens.spacing.xs + (name.bottom - name.top) <= frame.bounds.bottom;
    if (side === "above" && fitsBelow) found.push(`${who}: the name is above with room below`);
    if (side === "below" && name.top < circle.bottom - EPSILON) {
      found.push(`${who}: the name is not below its circle`);
    }
    drawn.forEach((other, otherIndex) => {
      // Two circles that nearly touch leave no room for a name between them: the rule holds for the rest.
      const crowded = !farFromOthers(marker, other, CROWDED_RADII * radius);
      if (crowded) return;
      if (otherIndex !== index && overlaps(name, circleOf(other, input.tokens))) {
        found.push(`${who}: the name covers the circle of ${other.chip.displayName}`);
      }
      if (otherIndex > index && overlaps(name, other.placed.name.box)) {
        found.push(`${who}: the name covers the name of ${other.chip.displayName}`);
      }
    });
    return found;
  });
}

function checkAll(phone: Phone, ends: readonly CourtEnd[]): readonly string[] {
  return ends.flatMap((end) =>
    [SHORT_NAMES, LONG_NAMES].flatMap((list) =>
      PHASES.flatMap((phase) =>
        FORMATION_SYSTEMS.flatMap((system) =>
          SETTER_ZONES.flatMap((setterZone) =>
            [false, true].flatMap((hasSetPoint) => {
              const panel = panelOf({ names: list, phase, system, setterZone, hasSetPoint });
              const input = { panel, layout: layoutOf(phone), tokens: tokensOf(phone), end };
              const where = `${String(phone.width)}+${String(phone.insetLeft)} ${end} ${list[0]} ${phase} ${system} z${String(setterZone)} sp=${String(hasSetPoint)}`;
              return problemsOf(input).map((problem) => `${where}: ${problem}`);
            }),
          ),
        ),
      ),
    ),
  );
}

describe("circles and names of every formation in landscape", () => {
  test.each(LANDSCAPE_PHONES)(
    "the circle is on its point and no name covers anything at $width+$insetLeft",
    (phone) => {
      expect(checkAll(phone, LANDSCAPE_ENDS)).toEqual([]);
    },
  );
});

describe("circles and names in the portrait fallback", () => {
  // The portrait is a fallback with a column that takes most of the zone: the circles keep every
  // rule, and a name may crowd another name or a circle there.
  test.each(PORTRAIT_PHONES)("the circles keep their rules at $width", (phone) => {
    const problems = checkAll(phone, PORTRAIT_ENDS).filter((text) => !text.includes("the name"));
    expect(problems).toEqual([]);
  });
});

describe("where the name goes", () => {
  test("every circle, the server included, has a name under it", () => {
    const phone = LANDSCAPE_PHONES[1] as Phone;
    const panel = panelOf({
      names: SHORT_NAMES,
      phase: "serving",
      system: "5x1",
      setterZone: 1,
      hasSetPoint: false,
    });
    const input = { panel, layout: layoutOf(phone), tokens: tokensOf(phone), end: "left" } as const;
    const drawn = layoutTeamMarkers(input);
    expect(drawn.every(({ placed }) => placed.name.text !== "")).toBe(true);
    const server = drawn.find(({ chip }) => chip.isServer) as DrawnMarker;
    expect(server.placed.name.side).toBe("below");
  });
});

describe("a team with a libero (seven circles and the badge)", () => {
  test.each(LANDSCAPE_PHONES)("nothing is covered at $width x $height", (phone) => {
    const base = panelOf({
      names: SHORT_NAMES,
      phase: "receiving",
      system: "5x1",
      setterZone: 1,
      hasSetPoint: false,
    });
    const reference = base.chips[4] as PlayerChipModel;
    const libero: PlayerChipModel = {
      ...reference,
      memberId: "m7",
      name: "Duda",
      displayName: "Duda",
      point: { x: 0.5, y: 0.92 },
      isLibero: true,
      isSetter: false,
    };
    const panel = { ...base, chips: [...base.chips, libero] };
    expect(panel.chips).toHaveLength(7);
    for (const end of LANDSCAPE_ENDS) {
      const input = { panel, layout: layoutOf(phone), tokens: tokensOf(phone), end };
      expect(problemsOf(input)).toEqual([]);
    }
  });
});

describe("the server stays whole inside the zone", () => {
  test.each(LANDSCAPE_PHONES)("with the margin kept at $width x $height", (phone) => {
    for (const end of LANDSCAPE_ENDS) {
      for (const hasSetPoint of [false, true]) {
        const panel = panelOf({
          names: SHORT_NAMES,
          phase: "serving",
          system: "5x1",
          setterZone: 1,
          hasSetPoint,
        });
        const input = { panel, layout: layoutOf(phone), tokens: tokensOf(phone), end } as const;
        const server = layoutTeamMarkers(input).find(({ chip }) => chip.isServer) as DrawnMarker;
        const zone = placementFrame(input).bounds;
        const reach = reachOf(server, input.tokens);
        expect(server.placed.y - reach).toBeGreaterThanOrEqual(zone.top - EPSILON);
        expect(server.placed.y + reach).toBeLessThanOrEqual(zone.bottom + EPSILON);
        expect(server.placed.x - reach).toBeGreaterThanOrEqual(zone.left - EPSILON);
        expect(server.placed.x + reach).toBeLessThanOrEqual(zone.right + EPSILON);
      }
    }
  });

  test("the zone bounds keep a margin from the edges of the zone", () => {
    const phone = LANDSCAPE_PHONES[1] as Phone;
    const layout = layoutOf(phone);
    const panel = panelOf({
      names: SHORT_NAMES,
      phase: "serving",
      system: "5x1",
      setterZone: 1,
      hasSetPoint: false,
    });
    const frame = placementFrame({ panel, layout, tokens: tokensOf(phone), end: "left" });
    const origin = squareOrigin(layout, "left");
    expect(frame.bounds.top).toBeCloseTo(-origin.y + MARKER_ZONE_MARGIN, 3);
    expect(frame.bounds.bottom).toBeCloseTo(layout.zoneHeight - origin.y - MARKER_ZONE_MARGIN, 3);
  });
});

describe("long names on a large landscape screen", () => {
  const BIG_PHONE: Phone = { width: 2340, height: 1080, insetLeft: 0 };
  const MIN_READABLE = 9;
  const FIRST_NAMES = ["Bernardete", "Valentina", "Wellington", "Christopher", "Ana", "Joaquim"];
  const long = (suffix: string) => FIRST_NAMES.map((first) => `${first} ${suffix}`);

  test("most names stay whole or as 'First I.', and nothing is covered", () => {
    const readable: boolean[] = [];
    const problems: string[] = [];
    for (const [end, suffix] of [
      ["left", "Ca."],
      ["right", "P."],
    ] as const) {
      const names = long(suffix);
      const panel = panelOf({
        names,
        phase: "receiving",
        system: "5x1",
        setterZone: 1,
        hasSetPoint: false,
      });
      const input = { panel, layout: layoutOf(BIG_PHONE), tokens: tokensOf(BIG_PHONE), end };
      problems.push(...problemsOf(input));
      layoutTeamMarkers(input).forEach(({ chip, placed }) => {
        const text = placed.name.text;
        readable.push(text === chip.displayName || /^\p{L}+ \p{L}\.$/u.test(text));
        expect(text).not.toMatch(/^\p{L}{1,2}… /u);
      });
    }
    expect(problems).toEqual([]);
    expect(readable.filter(Boolean).length).toBeGreaterThanOrEqual(MIN_READABLE);
  });
});
