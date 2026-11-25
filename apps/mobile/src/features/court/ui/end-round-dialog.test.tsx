import type { ReactElement, ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";

import { strings } from "../../../strings/pt-BR";
import { EndRoundDialog } from "./EndRoundDialog";

vi.mock("../../../ui/BottomSheet", () => ({ BottomSheet: "BottomSheet" }));
vi.mock("../../../ui/Button", () => ({ Button: "Button" }));
vi.mock("../../../ui/ConfirmSheet", () => ({ ConfirmSheet: "ConfirmSheet" }));
vi.mock("../../../ui/Text", () => ({ Text: "Text" }));

interface AnyProps {
  readonly children?: ReactNode;
  readonly label?: string;
  readonly onPress?: () => void;
  readonly onClose?: () => void;
  readonly title?: string;
  readonly body?: string;
  readonly confirmLabel?: string;
  readonly onConfirm?: () => void;
}

function flatten(node: ReactNode): ReactElement<AnyProps>[] {
  if (Array.isArray(node)) return node.flatMap((child) => flatten(child as ReactNode));
  if (node === null || typeof node !== "object") return [];
  const element = node as ReactElement<AnyProps>;
  return [element, ...flatten(element.props.children)];
}

/** The dialog returns an inner component element; render it one level down. */
function render(element: ReactElement): ReactElement<AnyProps> {
  const component = element.type as (props: unknown) => ReactElement<AnyProps>;
  return component(element.props);
}

describe("EndRoundDialog, not-started variant (ADR 0076, R101 D1)", () => {
  const { endRound } = strings.court;

  test("explains the round has not started and offers only 'Continuar jogando'", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const dialog = EndRoundDialog({
      sheet: { kind: "not-started", body: endRound.notStarted },
      onConfirm,
      onCancel,
    }) as ReactElement;
    const root = render(dialog);
    const nodes = flatten(root);
    const buttons = nodes.filter((node) => node.type === ("Button" as unknown));
    const texts = nodes.filter((node) => node.type === ("Text" as unknown));

    expect(root.props.title).toBe(endRound.title);
    expect(texts.map((text) => text.props.children)).toEqual([endRound.notStarted]);
    expect(buttons.map((button) => button.props.label)).toEqual([endRound.cancel]);
    expect(nodes.some((node) => node.props.label === endRound.confirm)).toBe(false);
    expect(nodes.some((node) => node.type === ("ConfirmSheet" as unknown))).toBe(false);

    buttons[0]?.props.onPress?.();
    root.props.onClose?.();
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  test("the confirm variant still shows the 'Encerrar rodada' button", () => {
    const dialog = EndRoundDialog({
      sheet: { kind: "confirm", body: "Foi 1 partida." },
      onConfirm: vi.fn(),
      onCancel: vi.fn(),
    }) as ReactElement;
    const root = render(dialog);

    expect(root.type).toBe("ConfirmSheet");
    expect(root.props.confirmLabel).toBe(endRound.confirm);
    expect(root.props.body).toBe("Foi 1 partida.");
  });
});
