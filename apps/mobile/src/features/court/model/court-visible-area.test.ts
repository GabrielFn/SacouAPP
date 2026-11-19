import { describe, expect, test } from "vitest";

import { SAMPLE_MATCH_LONG_NAMES } from "../dev/sample-match.data";
import { createScaledTokens, shortSide } from "../../../theme/scale";
import { computeCourtLayout } from "./court-layout";
import { selectCourtScreen } from "./court-screen.selectors";
import { ROSTER, startScenario } from "./screen-scenarios.test.fixture";
import { layoutTeamMarkers, markerRadius, squareOrigin } from "./team-markers";

const NO_INSETS = { insetTop: 0, insetBottom: 0, insetLeft: 0, insetRight: 0 };
const SCREENS = [
  { width: 640, height: 360 },
  { width: 780, height: 360 },
  { width: 844, height: 390 },
] as const;

/*
 * The zone height is the share of the area the screen really got (the view is measured, not the
 * window), minus the insets, so the strip below is never part of it. 780 x 360 is the Samsung
 * SM-S942B of the phone test of 18/11/2026.
 */
describe("everything of a half court is inside the zone, above the queue strip", () => {
  test.each(SCREENS)("at $width x $height", async (screen) => {
    const scenario = await startScenario(SAMPLE_MATCH_LONG_NAMES);
    const model = selectCourtScreen(scenario.timeline(), ROSTER);
    if (model === null) throw new Error("no court to show");
    const layout = computeCourtLayout({
      windowWidth: screen.width,
      windowHeight: screen.height,
      ...NO_INSETS,
    });
    const tokens = createScaledTokens({
      windowWidth: shortSide(screen.width, screen.height),
      fontScale: 1,
    });
    for (const [end, panel] of [
      ["left", model.teams.a],
      ["right", model.teams.b],
    ] as const) {
      const origin = squareOrigin(layout, end);
      const r = markerRadius(tokens);
      const lows = layoutTeamMarkers({ panel, layout, tokens, end }).map((m) => ({
        circle: origin.y + m.placed.y + r,
        name: origin.y + m.placed.name.box.bottom,
        circleTop: origin.y + m.placed.y - r,
      }));
      expect(Math.max(...lows.map((l) => l.name))).toBeLessThanOrEqual(layout.zoneHeight);
      expect(Math.max(...lows.map((l) => l.circle))).toBeLessThanOrEqual(layout.zoneHeight);
      expect(Math.min(...lows.map((l) => l.circleTop))).toBeGreaterThanOrEqual(0);
    }
  });
});
