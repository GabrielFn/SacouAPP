import { describe, expect, test } from "vitest";

import { SAMPLE_MATCH_LONG_NAMES } from "../dev/sample-match.data";
import { createScaledTokens, shortSide } from "../../../theme/scale";
import { computeCourtLayout } from "./court-layout";
import { selectCourtScreen } from "./court-screen.selectors";
import { ROSTER, score, startScenario } from "./screen-scenarios.test.fixture";
import { layoutTeamMarkers, markerRadius, squareOrigin } from "./team-markers";

/*
 * The server stands behind the end line, at the bottom corner of its half. Its circle (with the
 * badge) and its name must be whole inside the zone. The zone heights are the ones the phone gave
 * the row of the zones (uiautomator of 18/11/2026: 236 dp on the 780 x 360 Samsung SM-S942B), which
 * is less than the share of the weights, because the bar and the queue strip keep their content.
 */
const SCREENS = [
  { width: 780, height: 360, zone: 236 },
  { width: 640, height: 360, zone: 236 },
] as const;
const ROTATION_STEPS = 14;

describe("the server marker is whole inside the zone", () => {
  test.each(SCREENS)("at $width x $height, every rotation, both ends", async (screen) => {
    const scenario = await startScenario(SAMPLE_MATCH_LONG_NAMES);
    const layout = computeCourtLayout({
      windowWidth: screen.width,
      windowHeight: screen.height,
      insetTop: 0,
      insetBottom: 0,
      insetLeft: 0,
      insetRight: 0,
      measuredZoneHeight: screen.zone,
    });
    const tokens = createScaledTokens({
      windowWidth: shortSide(screen.width, screen.height),
      fontScale: 1,
    });
    const reach = markerRadius(tokens) + tokens.court.spacing.badgeOffsetX;
    let servers = 0;
    for (let step = 0; step < ROTATION_STEPS; step += 1) {
      const model = selectCourtScreen(scenario.timeline(), ROSTER);
      if (model === null) throw new Error("no court to show");
      for (const [end, panel] of [
        ["left", model.teams.a],
        ["right", model.teams.b],
      ] as const) {
        const origin = squareOrigin(layout, end);
        for (const m of layoutTeamMarkers({ panel, layout, tokens, end })) {
          if (!m.chip.isServer) continue;
          servers += 1;
          expect(origin.y + m.placed.y + reach).toBeLessThanOrEqual(screen.zone);
          expect(origin.y + m.placed.name.box.bottom).toBeLessThanOrEqual(screen.zone);
        }
      }
      await score(scenario, step % 2 === 0 ? "a" : "ab");
    }
    expect(servers).toBeGreaterThan(0);
  });
});
