import { describe, expect, test, vi } from "vitest";

import { createFakeKeyboardVisibility } from "../adapters/fake-keyboard-visibility";
import { BACKDROP_GRACE_MS, createBackdropDismiss } from "./backdrop-dismiss";

function setup() {
  const keyboard = createFakeKeyboardVisibility();
  const onClose = vi.fn();
  const clock = { value: 10_000 };
  const backdrop = createBackdropDismiss(keyboard, onClose, () => clock.value);
  return { keyboard, onClose, clock, backdrop };
}

describe("the backdrop of a sheet (R98 part 3)", () => {
  test("without the keyboard a tap on the backdrop closes the sheet", () => {
    const { backdrop, onClose } = setup();
    backdrop.onBackdropPress();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("with the keyboard up the tap only closes the keyboard and the sheet stays", () => {
    const { backdrop, onClose, keyboard } = setup();
    keyboard.show();
    backdrop.onBackdropPress();
    expect(onClose).not.toHaveBeenCalled();
    expect(keyboard.dismissCount()).toBe(1);
  });

  test("a tap that lands right after the keyboard went away is ignored", () => {
    const { backdrop, onClose, keyboard, clock } = setup();
    keyboard.show();
    keyboard.hide();
    clock.value += BACKDROP_GRACE_MS - 1;
    backdrop.onBackdropPress();
    expect(onClose).not.toHaveBeenCalled();
  });

  test("after the grace time the tap closes the sheet again", () => {
    const { backdrop, onClose, keyboard, clock } = setup();
    keyboard.show();
    keyboard.hide();
    clock.value += BACKDROP_GRACE_MS;
    backdrop.onBackdropPress();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("a sheet that never had the keyboard is not slowed down by the grace time", () => {
    const { backdrop, onClose, clock } = setup();
    clock.value = 0;
    backdrop.onBackdropPress();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("after release the backdrop no longer listens to the keyboard", () => {
    const { backdrop, onClose, keyboard } = setup();
    backdrop.release();
    keyboard.show();
    keyboard.hide();
    backdrop.onBackdropPress();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
