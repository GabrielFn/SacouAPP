import type { ReactElement } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { ReportReason } from "../../../services/api/sacou-api";
import { strings } from "../../../strings/pt-BR";
import { createScaledTokens } from "../../../theme/scale";
import { accessibilityFloors, fontScaleCap } from "../../../theme/tokens.data";
import { ReportSheet, type ReportSheetProps } from "./ReportSheet";

const state = vi.hoisted(() => ({
  reason: null as string | null,
  tokens: {},
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useState: () => [state.reason, () => undefined],
}));
vi.mock("react-native", () => ({ View: "View", Pressable: "Pressable", Text: "Text" }));
vi.mock("../../../theme/theme-context", () => ({
  useTheme: () => ({ tokens: state.tokens, colors: {} }),
}));
vi.mock("../../../ui/BottomSheet", () => ({ BottomSheet: () => null }));
vi.mock("../../../ui/Button", () => ({ Button: () => null }));
vi.mock("../../../ui/ErrorStrip", () => ({ ErrorStrip: () => null }));
vi.mock("../../../ui/RadioDot", () => ({ RadioDot: () => null }));
vi.mock("../../../ui/Text", () => ({ Text: () => null }));

interface SheetProps {
  readonly title: string;
  readonly children: unknown;
}
type Child = ReactElement<Record<string, unknown>> | null;
interface RowStyle {
  readonly minHeight: number;
}

/** The narrow phone, the common one and a small tablet (frontend.md, relative layout). */
const WIDTHS = [320, 390, 600];

function draw(overrides: Partial<ReportSheetProps> = {}) {
  const props: ReportSheetProps = {
    target: { kind: "member", memberId: "m", name: "Bia" },
    pending: false,
    errorText: null,
    onSubmit: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  const sheet = ReportSheet(props) as ReactElement<SheetProps>;
  const children = [sheet.props.children].flat() as readonly Child[];
  const named = (name: string) =>
    children.filter(
      (child): child is ReactElement<Record<string, unknown>> =>
        child !== null && typeof child.type === "function" && child.type.name === name,
    );
  const button = named("Button")[0];
  if (button === undefined) throw new Error("no button");
  const group = children.find((child) => child?.type === "View");
  const options = [group?.props.children].flat() as readonly ReactElement<{
    reason: ReportReason;
    selected: boolean;
  }>[];
  return { props, sheet, button, errors: named("ErrorStrip"), options };
}

describe("the sheet Denunciar (E6.6, criteria 2 to 5 and 14)", () => {
  beforeEach(() => {
    state.tokens = {};
    state.reason = null;
  });

  test("titles the member, or the group, and lists the four closed reasons", () => {
    expect(draw().sheet.props.title).toBe("Denunciar Bia");
    expect(draw({ target: { kind: "group" } }).sheet.props.title).toBe("Denunciar grupo");
    expect(draw().options.map((option) => option.props.reason)).toEqual([
      "offensiveName",
      "hateOrSexual",
      "impersonation",
      "spam",
    ]);
    expect(Object.values(strings.report.reasons)).toEqual([
      "Nome ou apelido ofensivo",
      "Ódio, assédio ou conteúdo sexual",
      "Se passando por outra pessoa",
      "Spam ou propaganda",
    ]);
  });

  test("Enviar denúncia is off until a reason is chosen", () => {
    expect(draw().button.props).toMatchObject({ label: "Enviar denúncia", disabled: true });
    state.reason = "spam";
    expect(draw().button.props.disabled).toBe(false);
    expect(draw().options.filter((option) => option.props.selected)).toHaveLength(1);
  });

  test("sends the chosen reason", () => {
    state.reason = "impersonation";
    const { button, props } = draw();
    (button.props.onPress as () => void)();
    expect(props.onSubmit).toHaveBeenCalledWith("impersonation");
  });

  test("while the call is on its way the button stays off", () => {
    state.reason = "spam";
    expect(draw({ pending: true }).button.props).toMatchObject({ disabled: true, busy: true });
  });

  test("a failure keeps the reason and shows the text in an ErrorStrip", () => {
    state.reason = "spam";
    const failed = draw({ errorText: "Sem conexão" });
    expect(failed.errors.map((strip) => strip.props.text)).toEqual(["Sem conexão"]);
    expect(failed.button.props.disabled).toBe(false);
    expect(draw().errors).toHaveLength(0);
  });

  test.each(WIDTHS.flatMap((width) => [1, fontScaleCap].map((fontScale) => [width, fontScale])))(
    "at %d wide and font %d each reason takes its sizes from the tokens, over the touch floor",
    (windowWidth, fontScale) => {
      const tokens = createScaledTokens({ windowWidth, fontScale });
      state.tokens = tokens;
      const rows = draw().options.map((option) => {
        const render = option.type as (
          props: typeof option.props,
        ) => ReactElement<{ style: RowStyle }>;
        return render(option.props).props.style;
      });
      expect(rows).toHaveLength(Object.keys(strings.report.reasons).length);
      for (const style of rows) {
        expect(style).toMatchObject({
          minHeight: tokens.sizes.minTouchTarget,
          gap: tokens.spacing.m,
          paddingVertical: tokens.spacing.s,
          borderTopWidth: tokens.borderWidths.thin,
        });
        expect(style.minHeight).toBeGreaterThanOrEqual(accessibilityFloors.touchTarget);
      }
    },
  );
});
