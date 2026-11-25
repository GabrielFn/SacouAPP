import { describe, expect, test } from "vitest";

import { endRoundBody } from "./end-round-view";

const BASE = {
  openMatchScore: null,
  finishedMatches: 0,
  votingEnabled: false,
  availability: "open",
} as const;

describe("endRoundBody (R101 3a)", () => {
  test("no match finished and nothing in play", () => {
    expect(endRoundBody(BASE)).toBe(
      "Nenhuma partida terminou ainda. Depois disso não dá para jogar outra nesta rodada.",
    );
  });

  test("one match, then five", () => {
    expect(endRoundBody({ ...BASE, finishedMatches: 1 })).toMatch(/^Foi 1 partida\. /);
    expect(endRoundBody({ ...BASE, finishedMatches: 5 })).toMatch(/^Foram 5 partidas\. /);
  });

  test("a match in play says it stays out of the summary, between the count and the consequence", () => {
    expect(endRoundBody({ ...BASE, finishedMatches: 2, openMatchScore: "12 × 10" })).toBe(
      "Foram 2 partidas. A partida em andamento (12 × 10) não entra no resumo. Depois disso não dá para jogar outra nesta rodada.",
    );
  });

  test("with the voting on, the consequence mentions the MVP voting", () => {
    expect(endRoundBody({ ...BASE, finishedMatches: 2, votingEnabled: true })).toBe(
      "Foram 2 partidas. Depois disso não dá para jogar outra nesta rodada, e a votação do MVP abre por 24 h.",
    );
  });
});
