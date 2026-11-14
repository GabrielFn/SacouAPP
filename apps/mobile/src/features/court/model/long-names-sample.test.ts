import { describe, expect, test } from "vitest";

import { SAMPLE_MATCH_LONG_NAMES } from "../dev/sample-match.data";
import { selectCourtScreen } from "./court-screen.selectors";
import { queueLabel } from "./screen-texts";
import { ROSTER, startScenario } from "./screen-scenarios.test.fixture";

async function longNamesScreen() {
  const scenario = await startScenario(SAMPLE_MATCH_LONG_NAMES);
  const model = selectCourtScreen(scenario.timeline(), ROSTER);
  if (model === null) throw new Error("no court to show");
  return model;
}

describe("the sample match with long names", () => {
  test("starts, with the libero of Laranja and the queue", async () => {
    const model = await longNamesScreen();
    expect(model.teams.a.chips).toHaveLength(6);
    expect(model.teams.b.chips).toHaveLength(6);
    expect(model.queue?.players).toHaveLength(2);
  });

  test("has two players with the same first name on the court and one more in the queue", async () => {
    const model = await longNamesScreen();
    const names = [...model.teams.a.chips, ...model.teams.b.chips].map(({ name }) => name);
    expect(names.filter((name) => name.startsWith("Ana "))).toHaveLength(3);
    expect(model.queue?.players.map(({ name }) => name)).toContain("Maximiliano Souza");
  });

  test("the chips draw the short names and keep the whole name for the screen reader", async () => {
    const model = await longNamesScreen();
    const chips = [...model.teams.a.chips, ...model.teams.b.chips];
    const byName = (name: string) => chips.find((chip) => chip.name === name);
    expect(byName("Maximiliano")?.displayName).toBe("Maximiliano");
    expect(byName("Ana Carolina")?.displayName).toBe("Ana Ca.");
    expect(byName("Ana Clara")?.displayName).toBe("Ana Cl.");
    expect(byName("João Pedro")?.displayName).toBe("João");
    expect(byName("Guilhermina")?.displayName).toBe("Guilhermina");
  });

  test("the queue pills use the short names, the reader says the whole ones", async () => {
    const model = await longNamesScreen();
    expect(model.queue?.players.map(({ displayName }) => displayName)).toEqual([
      "Maximiliano S.",
      "Ana P.",
    ]);
    expect(model.queue === null ? "" : queueLabel(model.queue)).toContain("Ana Paula Lima");
  });
});
