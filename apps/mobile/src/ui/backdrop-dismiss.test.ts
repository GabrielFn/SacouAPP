import { describe, expect, test } from "vitest";

import { createFakeKeyboardVisibility } from "../adapters/fake-keyboard-visibility";
import { BACKDROP_GRACE_MS, backdropAction } from "./backdrop-dismiss";

describe("the backdrop of a sheet (R98 part 3)", () => {
  test("without the keyboard a tap on the backdrop closes the sheet", () => {
    expect(backdropAction(false, Number.POSITIVE_INFINITY)).toBe("close-sheet");
  });

  test("with the keyboard up the tap only closes the keyboard and the sheet stays", () => {
    expect(backdropAction(true, Number.POSITIVE_INFINITY)).toBe("dismiss-keyboard");
  });

  test("a tap that lands right after the keyboard went away is ignored", () => {
    expect(backdropAction(false, BACKDROP_GRACE_MS - 1)).toBe("ignore");
    expect(backdropAction(false, 0)).toBe("ignore");
  });

  test("after the grace time the tap closes the sheet again", () => {
    expect(backdropAction(false, BACKDROP_GRACE_MS)).toBe("close-sheet");
  });
});

describe("the fake keyboard", () => {
  test("tells the listeners and closes on dismiss", () => {
    const keyboard = createFakeKeyboardVisibility();
    const seen: boolean[] = [];
    const stop = keyboard.subscribe((visible) => {
      seen.push(visible);
    });
    keyboard.show();
    keyboard.dismiss();
    stop();
    keyboard.show();
    expect(seen).toEqual([true, false]);
    expect(keyboard.dismissCount()).toBe(1);
  });
});
