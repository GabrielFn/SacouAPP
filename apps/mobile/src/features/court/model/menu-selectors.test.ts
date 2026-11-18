import { describe, expect, test } from "vitest";

import {
  endMatchSentence,
  endMatchSummary,
  isMenuScreenReady,
  menuSubtitle,
} from "./menu-selectors";
import {
  ROSTER,
  confirmSet,
  score,
  screen09,
  startScenario,
} from "./screen-scenarios.test.fixture";

describe("the header of the menu", () => {
  test("says the match number, the set and the score", async () => {
    const scenario = await screen09();
    expect(menuSubtitle(scenario.timeline(), ROSTER)).toBe(
      "Partida 1 · 2º set · Laranja 18–15 Azul",
    );
  });

  test("has no header once the match ended", async () => {
    const scenario = await screen09();
    await scenario.controller.dispatch({ type: "end-match-manually" });
    expect(menuSubtitle(scenario.timeline(), ROSTER)).toBeNull();
  });
});

describe("the pending screens of the menu", () => {
  test("Trocar jogador waits for its screen; Escalação (E4.8) and Corrigir are ready", () => {
    expect(isMenuScreenReady("lineup")).toBe(true);
    expect(isMenuScreenReady("substitution")).toBe(false);
    expect(isMenuScreenReady("corrections")).toBe(true);
  });
});

describe("the sentence of Encerrar partida", () => {
  test("sets ahead: the leader wins on sets", async () => {
    const scenario = await screen09();
    const summary = endMatchSummary(scenario.timeline(), ROSTER);
    expect(summary && endMatchSentence(summary)).toBe("Laranja vence: 1–0 em sets.");
  });

  test("level sets: the set in play decides, winner first", async () => {
    const scenario = await startScenario();
    await score(scenario, "a".repeat(25));
    await confirmSet(scenario);
    await score(scenario, "b".repeat(25));
    await confirmSet(scenario, "a");
    await score(scenario, "bbbbbbbbbbbbaaaaaaaaa");
    const summary = endMatchSummary(scenario.timeline(), ROSTER);
    expect(summary && endMatchSentence(summary)).toBe("Azul vence: lidera 12–9 no 3º set.");
  });

  test("level in everything: no winner, nobody leaves", async () => {
    const scenario = await startScenario();
    await score(scenario, "ab");
    const summary = endMatchSummary(scenario.timeline(), ROSTER);
    expect(summary && endMatchSentence(summary)).toBe("Sem vencedor: ninguém sai da quadra.");
  });

  test("a set decided and not confirmed leads to its confirmation", async () => {
    const scenario = await startScenario();
    await score(scenario, "a".repeat(25));
    expect(endMatchSummary(scenario.timeline(), ROSTER)).toEqual({ kind: "confirm-set" });
  });
});
