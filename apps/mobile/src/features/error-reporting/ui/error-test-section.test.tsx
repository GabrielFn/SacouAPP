import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";

import { createFakeErrorReporter } from "../../../adapters/fake-error-reporter";
import { strings } from "../../../strings/pt-BR";
import { createScaledTokens } from "../../../theme/scale";
import { accessibilityFloors, fontScaleCap } from "../../../theme/tokens.data";
import { DeliberateFailure, ERROR_TEST_AREA, ErrorTestSection } from "./ErrorTestSection";

const devTools = vi.hoisted(() => ({ enabled: true }));

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => [initial, vi.fn()],
}));
vi.mock("react-native", () => ({ View: "View", ScrollView: "ScrollView" }));
vi.mock("expo-router", () => ({ Redirect: "Redirect" }));
vi.mock("../../../config/dev-tools", () => ({
  get DEV_TOOLS_ENABLED() {
    return devTools.enabled;
  },
}));
vi.mock("../../../services/services-context", () => ({
  useServices: () => ({ errorReporter: createFakeErrorReporter() }),
}));
vi.mock("../../../theme/theme-context", () => ({
  useTheme: () => ({ tokens: { spacing: {} }, colors: {} }),
  ThemeProvider: "ThemeProvider",
}));
vi.mock("../../../ui/Button", () => ({ Button: "Button" }));
vi.mock("../../../ui/Text", () => ({ Text: "Text" }));
vi.mock("../../../ui/AppHeader", () => ({ AppHeader: "AppHeader" }));
vi.mock("../../../ui/Card", () => ({ Card: "Card" }));
vi.mock("../../../ui/Chip", () => ({ Chip: "Chip" }));
vi.mock("../../../ui/IconButton", () => ({ IconButton: "IconButton" }));
vi.mock("../../../ui/Icons", () => ({ PlusIcon: "PlusIcon" }));
vi.mock("../../../ui/StatusPill", () => ({ StatusPill: "StatusPill" }));
vi.mock("../../../ui/TextField", () => ({ TextField: "TextField" }));

interface ButtonProps {
  readonly label?: string;
  readonly onPress?: () => void;
  readonly children?: ReactNode;
}

function elementsOf(node: ReactNode): readonly ReactElement<ButtonProps>[] {
  if (Array.isArray(node)) return node.flatMap((child: ReactNode) => elementsOf(child));
  if (!isValidElement(node)) return [];
  const element = node as ReactElement<ButtonProps>;
  return [element, ...elementsOf(element.props.children)];
}

function buttonsOf(node: ReactNode): readonly ButtonProps[] {
  return elementsOf(node)
    .filter((element) => element.type === "Button")
    .map((element) => element.props);
}

const texts = strings.catalog.errorTest;
const WIDTHS = [320, 390, 600];

describe("the error test of the development screen (E5.2, D12)", () => {
  test("the two buttons come from the texts file", () => {
    const reporter = createFakeErrorReporter();
    const labels = buttonsOf(ErrorTestSection({ errorReporter: reporter })).map((b) => b.label);
    expect(labels).toEqual([texts.sendError, texts.crashApp]);
  });

  test("Enviar erro de teste sends one deliberate failure, tagged with the area", () => {
    const reporter = createFakeErrorReporter();
    const [send] = buttonsOf(ErrorTestSection({ errorReporter: reporter }));
    send?.onPress?.();
    expect(reporter.captured()).toHaveLength(1);
    expect(reporter.captured()[0]?.error).toBeInstanceOf(DeliberateFailure);
    expect(reporter.captured()[0]?.context).toEqual({ area: ERROR_TEST_AREA });
    expect(reporter.nativeCrashes()).toBe(0);
  });

  test("Travar o app (teste) asks for the native crash once", () => {
    const reporter = createFakeErrorReporter();
    const [, crash] = buttonsOf(ErrorTestSection({ errorReporter: reporter }));
    crash?.onPress?.();
    expect(reporter.nativeCrashes()).toBe(1);
    expect(reporter.captured()).toHaveLength(0);
  });

  test("the deliberate failure carries a fixed English message, no personal data", () => {
    expect(new DeliberateFailure().message).toBe(
      "Deliberate failure from the development screen (E5.2).",
    );
  });

  test.each(WIDTHS.flatMap((width) => [1, fontScaleCap].map((fontScale) => [width, fontScale])))(
    "at %d wide and font %d the buttons stay over the touch floor",
    (windowWidth, fontScale) => {
      const tokens = createScaledTokens({ windowWidth, fontScale });
      expect(tokens.sizes.primaryButton).toBeGreaterThanOrEqual(accessibilityFloors.touchTarget);
    },
  );
});

describe("the catalog shows the error test only with the development tools (D12)", () => {
  test("with EXPO_PUBLIC_DEV_TOOLS off the screen sends the person home, without the buttons", async () => {
    devTools.enabled = false;
    const { default: CatalogScreen } = await import("../../../app/dev/catalog");
    const drawn = CatalogScreen();
    expect(isValidElement(drawn) && drawn.type).toBe("Redirect");
    expect(elementsOf(drawn).some((element) => element.type === ErrorTestSection)).toBe(false);
  });

  test("with them on the screen starts with the error test", async () => {
    devTools.enabled = true;
    const { default: CatalogScreen } = await import("../../../app/dev/catalog");
    const drawn = CatalogScreen();
    expect(elementsOf(drawn).some((element) => element.type === ErrorTestSection)).toBe(true);
  });
});
