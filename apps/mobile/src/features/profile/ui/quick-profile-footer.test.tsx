import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";

import { strings } from "../../../strings/pt-BR";
import { QuickProfileFooter } from "./QuickProfileScreen";

const BUTTON = vi.hoisted(() => function Button() {});

vi.mock("react-native", () => ({ View: "View" }));
vi.mock("../../../theme/theme-context", () => ({ useTheme: () => ({ tokens: { spacing: {} } }) }));
vi.mock("../../../ui/AppHeader", () => ({ AppHeader: () => null }));
vi.mock("../../../ui/BackBar", () => ({ BackBar: () => null }));
vi.mock("../../../ui/Button", () => ({ Button: BUTTON }));
vi.mock("../../../ui/ErrorStrip", () => ({ ErrorStrip: () => null }));
vi.mock("../../../ui/Screen", () => ({ Screen: () => null }));
vi.mock("../../../ui/Text", () => ({ Text: () => null }));
vi.mock("../../../ui/TextField", () => ({ TextField: () => null }));
vi.mock("./LevelPicker", () => ({ LevelPicker: () => null }));
vi.mock("./PositionChips", () => ({ PositionChips: () => null }));
vi.mock("../hooks/use-quick-profile", () => ({ useQuickProfile: () => ({}) }));

interface ButtonProps {
  readonly label: string;
  readonly disabled?: boolean;
}

function buttonsOf(node: ReactNode): readonly ButtonProps[] {
  if (Array.isArray(node)) return node.flatMap((child: ReactNode) => buttonsOf(child));
  if (!isValidElement(node)) return [];
  const element = node as ReactElement<{ readonly children?: ReactNode } & ButtonProps>;
  if (element.type === BUTTON) return [element.props];
  return buttonsOf(element.props.children);
}

function skipButton(saving: boolean): ButtonProps | undefined {
  const footer = QuickProfileFooter({
    mode: "onboarding",
    disabled: saving,
    saving,
    onSubmit: () => undefined,
    onSkip: () => undefined,
  });
  return buttonsOf(footer).find((button) => button.label === strings.profile.skip);
}

describe("the footer of the quick profile (screen 27)", () => {
  test("Pular is off while Pronto is saving, so it never overwrites the saved profile", () => {
    expect(skipButton(true)?.disabled).toBe(true);
  });

  test("Pular is on when nothing is being saved", () => {
    expect(skipButton(false)?.disabled).toBe(false);
  });
});
