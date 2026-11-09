import { describe, expect, test } from "vitest";

import { strings } from "../../../strings/pt-BR";
import { selectCourtScreen } from "./court-screen.selectors";
import { hintText, queueExitText, queueLabel, setsLabel, streakText } from "./screen-texts";
import { ROSTER, screen09, screen10, type Scenario } from "./screen-scenarios.test.fixture";
import { zoneLabel } from "./zone-label";

function modelOf(scenario: Scenario) {
  const model = selectCourtScreen(scenario.timeline(), ROSTER);
  if (model === null) throw new Error("no court");
  return model;
}

describe("the texts of screen 09 are those of the design", () => {
  test("the labels of the two zones and the strip", async () => {
    const model = modelOf(await screen09());
    expect(zoneLabel(model.teams.a)).toBe(
      "Ponto para Laranja. Placar 18. Laranja sacando, João no saque",
    );
    expect(zoneLabel(model.teams.b)).toBe("Ponto para Azul. Placar 15. Azul em recepção");
    expect(hintText(model)).toBe("Posições no momento do saque");
    expect(setsLabel(model)).toBe("Sets: Laranja 1, Azul 0");
    expect(strings.court.header.setTitle(model.setNumber)).toBe("2º set");
  });

  test("the queue row", async () => {
    const model = modelOf(await screen09());
    expect(model.queue && queueLabel(model.queue)).toBe("Na fila: Davi, Sofia (reservas)");
    expect(queueExitText(model.queue)).toBe("perde sai · saída parcial");
    expect(streakText(model)).toBeNull();
  });
});

describe("the texts of screen 10 are those of the design", () => {
  test("set point in the label of the zone and in the strip", async () => {
    const model = modelOf(await screen10());
    expect(zoneLabel(model.teams.a)).toBe(
      "Ponto para Laranja. Placar 24, set point. Laranja sacando, Pedro no saque",
    );
    expect(zoneLabel(model.teams.b)).toBe("Ponto para Azul. Placar 21. Azul em recepção");
    expect(hintText(model)).toBe("Mais um ponto e o Laranja fecha o set");
  });
});

describe("other texts", () => {
  test("both teams at set point", () => {
    expect(strings.court.strip.nextPointCloses).toBe("Quem fizer o próximo ponto fecha o set");
  });

  test("the streak and the exit of a full team", () => {
    expect(strings.court.queue.streak("Laranja", 2)).toBe("Laranja venceu 2 seguidas");
    expect(queueExitText({ teams: [{ key: "x", players: [] }], players: [], exit: "full" })).toBe(
      "perde sai",
    );
    expect(queueExitText(null)).toBeNull();
  });

  test("the zone label without a known server only says who serves", () => {
    expect(
      strings.court.zone.pointFor({
        team: "Azul",
        score: 3,
        setPoint: false,
        serving: true,
        serverName: null,
      }),
    ).toBe("Ponto para Azul. Placar 3. Azul sacando");
  });

  test("a score with more than two digits is said in full", () => {
    expect(
      strings.court.zone.pointFor({
        team: "Azul",
        score: 1234,
        setPoint: false,
        serving: false,
        serverName: null,
      }),
    ).toContain("Placar 1234.");
  });
});
