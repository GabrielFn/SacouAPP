import { describe, expect, test } from "vitest";

import { courtHref } from "../navigation";
import { refusalText } from "./refusal-text";

describe("the text of a refusal", () => {
  test("each known code has its own sentence", () => {
    expect(refusalText({ code: "refused", reason: "set-decided" })).toBe(
      "O set já foi decidido. Confirme o fim do set.",
    );
    expect(refusalText({ code: "refused", reason: "rotation-off" })).toBe(
      "Este time está sem rotação.",
    );
    expect(refusalText({ code: "refused", reason: "nothing-to-undo" })).toBe(
      "Não há nada para desfazer.",
    );
    expect(refusalText({ code: "refused", reason: "invalid-point-author" })).toBe(
      "Esse jogador não pode ter feito esse ponto.",
    );
  });

  test("an unknown code and a failed write say the generic sentence", () => {
    const generic = "Não foi possível fazer isso agora. Nada mudou.";
    expect(refusalText({ code: "refused", reason: "queue-unchanged" })).toBe(generic);
    expect(refusalText({ code: "rejected" })).toBe(generic);
    expect(refusalText({ code: "not-ready" })).toBe(generic);
  });
});

describe("the route of the court", () => {
  test("carries the session and no theme (the theme is a preference)", () => {
    expect(courtHref("menu", { courtSessionId: "s1" })).toEqual({
      pathname: "/court/[courtSessionId]/menu",
      params: { courtSessionId: "s1" },
    });
  });
});
