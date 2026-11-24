import type { ReactNode } from "react";
import { Pressable } from "react-native";

import { useTheme } from "../theme/theme-context";
import type { ScaledTokens } from "../theme/scale";
import type { Theme } from "../theme/themes";
import { fontFamilies } from "../theme/tokens.data";

import { Text } from "./Text";

export type ButtonVariant =
  "primary" | "secondary" | "link" | "outline" | "danger" | "dangerOutline" | "dangerText";

export interface ButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: ButtonVariant;
  readonly fill?: boolean;
  readonly accessibilityLabel?: string;
  /** What a screen reader adds after the label, e.g. why the button is off. */
  readonly accessibilityHint?: string;
  /** Looks off, tells the screen reader and never calls `onPress`. */
  readonly disabled?: boolean;
  /** Working on it ("Carregando o placar..."): off like `disabled`, and the screen reader says busy. */
  readonly busy?: boolean;
  /** An icon before the label, drawn in the color of the label. */
  readonly renderIcon?: (color: string) => ReactNode;
}

const DISABLED_OPACITY = 0.6;

interface ButtonLook {
  readonly background: string;
  readonly foreground: string;
  /** The color of the outline, or `null` for none. */
  readonly border: string | null;
}

function lookOf(variant: ButtonVariant, colors: Theme): ButtonLook {
  const none = "transparent";
  return {
    primary: { background: colors.primary, foreground: colors.onPrimary, border: null },
    secondary: { background: colors.text, foreground: colors.background, border: null },
    link: { background: none, foreground: colors.link, border: null },
    outline: { background: none, foreground: colors.text, border: colors.text },
    danger: { background: colors.danger, foreground: colors.surface, border: null },
    dangerOutline: { background: none, foreground: colors.danger, border: colors.danger },
    dangerText: { background: none, foreground: colors.danger, border: null },
  }[variant];
}

function labelStyleOf(isLink: boolean, foreground: string, tokens: ScaledTokens) {
  return {
    color: foreground,
    flexShrink: 1,
    textAlign: "center" as const,
    fontFamily: isLink ? fontFamilies.body600 : fontFamilies.body700,
    fontSize: isLink ? tokens.fontSizes.link : tokens.fontSizes.button,
    textDecorationLine: isLink ? ("underline" as const) : ("none" as const),
  };
}

function containerStyleOf(
  look: ButtonLook,
  disabled: boolean,
  fill: boolean,
  tokens: ScaledTokens,
) {
  return {
    opacity: disabled ? DISABLED_OPACITY : 1,
    flex: fill ? 1 : undefined,
    flexDirection: "row" as const,
    gap: tokens.spacing.s,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: look.background,
    borderWidth: look.border === null ? undefined : tokens.borderWidths.thin,
    borderColor: look.border ?? look.background,
    minHeight: tokens.sizes.primaryButton,
    borderRadius: tokens.radii.button,
    paddingHorizontal: tokens.spacing.m,
  };
}

export function Button({
  label,
  onPress,
  variant = "primary",
  fill = false,
  accessibilityLabel,
  accessibilityHint,
  disabled = false,
  busy = false,
  renderIcon,
}: ButtonProps) {
  const { colors, tokens } = useTheme();
  const isLink = variant === "link";
  const look = lookOf(variant, colors);
  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole={isLink ? "link" : "button"}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: off, busy }}
      disabled={off}
      onPress={off ? undefined : onPress}
      style={containerStyleOf(look, off, fill, tokens)}
    >
      {renderIcon === undefined ? null : renderIcon(look.foreground)}
      <Text style={labelStyleOf(isLink, look.foreground, tokens)}>{label}</Text>
    </Pressable>
  );
}
