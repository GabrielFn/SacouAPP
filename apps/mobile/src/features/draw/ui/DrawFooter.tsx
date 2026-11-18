import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { Button } from "../../../ui/Button";
import { Text } from "../../../ui/Text";
import type { DrawMode } from "../model/draw-flow.reducer";
import { LockButtonIcon, SwapIcon } from "./DrawIcons";

const { draw } = strings;
const DISABLED_OPACITY = 0.6;

export interface FooterButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled: boolean;
  /** `undefined` for an action; `true`/`false` for one of the two modes. */
  readonly selected?: boolean;
  readonly renderIcon?: (color: string) => ReactNode;
}

/** A button of the row of three (Sorteio.dc.html): outlined, the chosen mode shows in a thicker outline. */
function FooterButton({ label, onPress, disabled, selected, renderIcon }: FooterButtonProps) {
  const { colors, tokens } = useTheme();
  const chosen = selected === true;
  const foreground = colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={selected === undefined ? { disabled } : { disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: tokens.sizes.field,
        borderRadius: tokens.radii.field,
        borderWidth: chosen ? tokens.borderWidths.thick : tokens.borderWidths.thin,
        borderColor: colors.text,
        backgroundColor: colors.surface,
        opacity: disabled ? DISABLED_OPACITY : 1,
        paddingHorizontal: tokens.spacing.xs,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: tokens.spacing.s6,
      }}
    >
      {renderIcon?.(foreground)}
      <Text variant="bodyStrong" style={{ color: foreground, flexShrink: 1, textAlign: "center" }}>
        {label}
      </Text>
    </Pressable>
  );
}

export interface DrawFooterProps {
  readonly hint: string;
  readonly mode: DrawMode;
  /** "Montar times": no lock (only the server draws with locks), and "Montar de novo" needs no network. */
  readonly manual: boolean;
  readonly lockAction: "lock" | "unlock";
  /** Everything off while a draw is on its way. */
  readonly busy: boolean;
  readonly online: boolean;
  /** Off when someone left the list since the draw (D4). */
  readonly canConfirm: boolean;
  readonly onSwap: () => void;
  readonly onLock: () => void;
  readonly onUnlock: () => void;
  readonly onRedraw: () => void;
  readonly onConfirm: () => void;
}

/** The label and the state of the third button: "Sortear de novo", or "Montar de novo" by hand. */
function redrawButton(props: DrawFooterProps): { readonly label: string; readonly off: boolean } {
  if (props.manual) return { label: draw.manual.rebuild, off: props.busy };
  return {
    label: props.online ? draw.redraw : draw.offlineRedraw,
    off: props.busy || !props.online,
  };
}

/** The hint, "Trocar", "Travar dupla", "Sortear de novo" and "Confirmar e compartilhar". */
export function DrawFooter(props: DrawFooterProps) {
  const { tokens } = useTheme();
  const { busy, mode } = props;
  const again = redrawButton(props);
  const unlock = props.lockAction === "unlock";
  return (
    <>
      <Text variant="caption" accessibilityLiveRegion="polite" style={{ textAlign: "center" }}>
        {props.hint}
      </Text>
      <View style={{ flexDirection: "row", gap: tokens.spacing.s }}>
        <FooterButton
          label={draw.swap}
          selected={mode === "swap"}
          disabled={busy}
          onPress={props.onSwap}
          renderIcon={(color) => <SwapIcon color={color} />}
        />
        {props.manual ? null : (
          <FooterButton
            label={unlock ? draw.unlock : draw.lock}
            selected={unlock ? undefined : mode === "lock"}
            disabled={busy}
            onPress={unlock ? props.onUnlock : props.onLock}
            renderIcon={(color) => <LockButtonIcon color={color} />}
          />
        )}
        <FooterButton label={again.label} disabled={again.off} onPress={props.onRedraw} />
      </View>
      <Button label={draw.confirm} disabled={busy || !props.canConfirm} onPress={props.onConfirm} />
    </>
  );
}
