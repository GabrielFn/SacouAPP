import { describe, expect, test } from "vitest";

import { shareTextOf } from "./create-round.selectors";

const URL = "https://sacou-api-abc123-uk.a.run.app/r/K7fQ2xK7fQ2xK7fQ2xK7fQ";

describe("the WhatsApp message of screen 20 (E3.12, ADR 0070, D1)", () => {
  test("with the round page's link, it ends in 'Confirma aqui: <url>'", () => {
    expect(shareTextOf("Vôlei de quinta", "Ter, 3/11", "20h30", "Arena", 14, URL)).toBe(
      `Vôlei de quinta · Ter, 3/11 · 20h30 · Arena · 14 vagas. Confirma aqui: ${URL}`,
    );
  });

  test("without the link (a member without ManageRounds, no public base), the text of before", () => {
    expect(shareTextOf("Vôlei de quinta", "Ter, 3/11", "20h30", "Arena", 14, null)).toBe(
      "Vôlei de quinta · Ter, 3/11 · 20h30 · Arena · 14 vagas. Confirma no app Sacou.",
    );
  });

  test("without a venue and without a limit, the link still closes the message", () => {
    expect(shareTextOf("Racha", "Qui, 5/11", "19h", "  ", null, URL)).toBe(
      `Racha · Qui, 5/11 · 19h. Confirma aqui: ${URL}`,
    );
    expect(shareTextOf("Racha", "Qui, 5/11", "19h", "", null, null)).toBe(
      "Racha · Qui, 5/11 · 19h. Confirma no app Sacou.",
    );
  });
});
