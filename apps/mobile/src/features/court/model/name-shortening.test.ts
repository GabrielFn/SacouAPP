import { describe, expect, test } from "vitest";

import { createScaledTokens, shortSide } from "../../../theme/scale";
import { placeMarkers } from "./marker-placement";
import { nameOptions } from "./team-markers";

const tokens = createScaledTokens({ windowWidth: shortSide(844, 390), fontScale: 1 });
const ELLIPSIS = "…";

describe("the shortening order of a name", () => {
  test("full name, then first name and initial, then first name, then cuts of at least three letters", () => {
    const options = nameOptions("Fernanda Souza", tokens);
    const texts = options.map(({ text }) => text);
    expect(texts.slice(0, 2)).toEqual(["Fernanda Souza", "Fernanda S."]);
    expect([...texts].sort()).toEqual(
      [
        "Fernanda Souza",
        "Fernanda S.",
        "Fernanda",
        `Fernand${ELLIPSIS}`,
        `Fernan${ELLIPSIS}`,
        `Ferna${ELLIPSIS}`,
        `Fern${ELLIPSIS}`,
        `Fer${ELLIPSIS}`,
      ].sort(),
    );
    expect(texts.at(-1)).toBe(`Fer${ELLIPSIS}`);
    expect(texts.indexOf("Fernanda")).toBeLessThan(texts.indexOf(`Fernan${ELLIPSIS}`));
  });

  test("no cut keeps fewer than three letters", () => {
    for (const name of ["Ana Clara", "Bia", "Wellington Pereira"]) {
      for (const { text } of nameOptions(name, tokens)) {
        if (text.endsWith(ELLIPSIS)) expect(Array.from(text).length - 1).toBeGreaterThanOrEqual(3);
      }
    }
  });

  test("an abbreviation that already came from disambiguation stays as the first option", () => {
    const texts = nameOptions("Ana Ca.", tokens).map(({ text }) => text);
    expect(texts.slice(0, 2)).toEqual(["Ana Ca.", "Ana C."]);
  });
});

describe("the side of a name that has room on both sides", () => {
  test("goes below its circle, attached to it, before going above", () => {
    const side = 400;
    const [marker] = placeMarkers(
      {
        end: "left",
        side,
        bounds: { left: 0, top: 0, right: side, bottom: side },
        column: null,
        gap: 4,
      },
      [
        {
          id: "a",
          point: { x: 0.5, y: 0.5 },
          radius: 15,
          reach: 15,
          names: [{ text: "Ana", width: 40 }],
          nameHeight: 16,
        },
      ],
    );
    expect(marker?.name.side).toBe("below");
    expect(marker?.name.box.top).toBeCloseTo((marker?.y ?? 0) + 15 + 4, 6);
  });
});
