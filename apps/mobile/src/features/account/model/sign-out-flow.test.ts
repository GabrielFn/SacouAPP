import { describe, expect, test, vi } from "vitest";

import { strings } from "../../../strings/pt-BR";
import { signOutOrWarn, unsentWarningText } from "./sign-out-flow";

describe("Sair with court events not sent (question 84)", () => {
  test("without any, signs out at once", async () => {
    const signOut = vi.fn();
    const warn = vi.fn();
    await signOutOrWarn({
      countUnsent: () => Promise.resolve({ events: 0, points: 0 }),
      signOut,
      warn,
    });
    expect(signOut).toHaveBeenCalledOnce();
    expect(warn).not.toHaveBeenCalled();
  });

  test("with some, warns and does not sign out", async () => {
    const signOut = vi.fn();
    const warn = vi.fn();
    await signOutOrWarn({
      countUnsent: () => Promise.resolve({ events: 3, points: 2 }),
      signOut,
      warn,
    });
    expect(warn).toHaveBeenCalledWith({ events: 3, points: 2 });
    expect(signOut).not.toHaveBeenCalled();
  });

  test("the text counts the points, with the singular, or speaks of the other marks", () => {
    const texts = strings.account.unsent;
    expect(unsentWarningText({ events: 1, points: 1 })).toBe(texts.points(1));
    expect(texts.points(1)).toContain("1 ponto desta quadra ainda não foi enviado");
    expect(unsentWarningText({ events: 5, points: 4 })).toContain("4 pontos");
    expect(unsentWarningText({ events: 2, points: 0 })).toBe(texts.otherEvents);
  });
});
