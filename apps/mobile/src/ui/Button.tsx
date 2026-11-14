import { Pressable } from "react-native";

import { useTheme } from "../theme/theme-context";
import type { ScaledTokens } from "../theme/scale";
import type { Theme } from "../theme/themes";
import { fontFamilies } from "../theme/tokens.data";

import { Text } from "./Text";

export type ButtonVariant = "primary" | "secondary" | "link";

export interface ButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: ButtonVariant;
  readonly fill?: boolean;
  readonly accessibilityLabel?: string;
  /** Looks off, tells the screen reader and never calls `onPress`. */
  readonly disabled?: boolean;
}

const DISABLED_OPACITY = 0.6;

function lookOf(variant: ButtonVariant, colors: Theme) {
  return {
    primary: { background: colors.primary, foreground: colors.onPrimary },
    secondary: { background: colors.text, foreground: colors.background },
    link: { background: "transparent", foreground: colors.link },
  }[variant];
}

function labelStyleOf(isLink: boolean, foreground: string, tokens: ScaledTokens) {
  return {
    color: foreground,
    fontFamily: isLink ? fontFamilies.body600 : fontFamilies.body700,
    fontSize: isLink ? tokens.fontSizes.link : tokens.fontSizes.button,
    textDecorationLine: isLink ? ("underline" as const) : ("none" as const),
  };
}

export function Button({
  label,
  onPress,
  variant = "primary",
  fill = false,
  accessibilityLabel,
  disabled = false,
}: ButtonProps) {
  const { colors, tokens } = useTheme();
  const isLink = variant === "link";
  const look = lookOf(variant, colors);
  return (
    <Pressable
      accessibilityRole={isLink ? "link" : "button"}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      style={{
        opacity: disabled ? DISABLED_OPACITY : 1,
        flex: fill ? 1 : undefined,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: look.background,
        minHeight: tokens.sizes.primaryButton,
        borderRadius: tokens.radii.button,
        paddingHorizontal: tokens.spacing.xl,
      }}
    >
      <Text style={labelStyleOf(isLink, look.foreground, tokens)}>{label}</Text>
    </Pressable>
  );
}
