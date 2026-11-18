import { getLineupBySlot, type TeamState } from "@sacou/match-engine";
import type { FormationPhase, FormationSystem, SetterZone } from "@sacou/volley-rules";
import { describe, expect, test } from "vitest";

import { fixRoles, misplacedMembers } from "./fix-roles";
import { initialLineupEditorState } from "./lineup-editor.reducer";
import { courtChips, serverOf } from "./lineup-court";
import { lineupView } from "./lineup-selectors";
import golden from "./lineup-scenarios.json";
import {
  baseOf,
  nameOf,
  positionsOf,
  sourceOf,
  teamSource,
  teamState,
} from "./lineup.test.fixture";

interface Scenario {
  readonly name: string;
  readonly system: string;
  readonly lineup: readonly string[];
  readonly setterZone: number;
  readonly phase: string;
  readonly positions: Readonly<Record<string, string | undefined>>;
}

function stateOf(scenario: Scenario): TeamState {
  return teamState(
    scenario.lineup,
    scenario.setterZone as SetterZone,
    scenario.system as FormationSystem,
  );
}

describe("screen 22 golden (lineup-scenarios.json, D4)", () => {
  test.each(golden.scenarios.map((scenario) => [scenario.name, scenario] as const))(
    "%s",
    (_name, scenario) => {
      const draft = stateOf(scenario);
      const phase = scenario.phase as FormationPhase;
      const positionOf = positionsOf(scenario.positions);
      const misplaced = misplacedMembers(draft, positionOf);
      const chips = courtChips({ draft, phase, misplaced, selection: null, nameOf });
      const base = baseOf(draft, "a");
      const view = lineupView(
        initialLineupEditorState("a"),
        sourceOf(teamSource("a", base, { phase }), teamSource("b", null), scenario.positions),
      );
      const { expected } = scenario;
      expect(getLineupBySlot(draft.lineup, draft.setterZone)).toEqual(expected.officialOrder);
      expect(view.team?.order.map((cell) => cell.name)).toEqual(expected.officialOrder.map(nameOf));
      expect(serverOf(draft, phase)).toBe(expected.server);
      expect(chips.filter((chip) => chip.isServer).map((chip) => chip.memberId)).toEqual(
        expected.server === null ? [] : [expected.server],
      );
      expect(
        chips
          .filter((chip) => chip.isSetter)
          .map((chip) => chip.memberId)
          .sort(),
      ).toEqual([...expected.setters].sort());
      expect(misplaced).toEqual(expected.misplaced);
      expect(view.team?.warning).toBe(expected.warning);
      const checked = view.team?.rotation?.options.find((option) => option.checked)?.value ?? null;
      expect(checked).toBe(expected.checkedRotation);
      const fixed = fixRoles(draft, positionOf);
      expect(fixed.lineup).toEqual(expected.fixedLineup);
      expect(fixed.setterZone).toBe(draft.setterZone);
      expect(misplacedMembers(fixed, positionOf)).toEqual([]);
    },
  );
});
