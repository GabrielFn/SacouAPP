import { describe, expect, test, vi } from "vitest";

import { createFakeClock } from "../adapters/fake-clock";
import { createFakeKeyboardVisibility } from "../adapters/fake-keyboard-visibility";
import { BACKDROP_GRACE_MS } from "./backdrop-dismiss";

const services = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("../services/services-context", () => ({ useServices: () => services.current }));
// No renderer here: one ref that lives on and effects that run at once.
vi.mock("react", () => {
  const ref = { current: Number.NEGATIVE_INFINITY };
  return { useRef: () => ref, useEffect: (effect: () => void) => void effect() };
});

import { useBackdropPress } from "./use-backdrop-press";

function setup() {
  const keyboard = createFakeKeyboardVisibility();
  const clock = createFakeClock(10_000);
  services.current = { keyboard, clock };
  const onClose = vi.fn();
  const press = useBackdropPress(onClose);
  return { keyboard, clock, onClose, press };
}

describe("useBackdropPress (R98 part 3)", () => {
  test("with the keyboard open the tap closes the keyboard and not the sheet", () => {
    const { keyboard, onClose, press } = setup();
    keyboard.show();
    press();
    expect(keyboard.dismissCount()).toBe(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  test("a tap within the grace time after the keyboard closed is ignored", () => {
    const { keyboard, clock, onClose, press } = setup();
    keyboard.show();
    keyboard.hide();
    clock.advance(BACKDROP_GRACE_MS - 1);
    press();
    expect(onClose).not.toHaveBeenCalled();
  });

  test("after the grace time the tap closes the sheet", () => {
    const { keyboard, clock, onClose, press } = setup();
    keyboard.show();
    keyboard.hide();
    clock.advance(BACKDROP_GRACE_MS);
    press();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
