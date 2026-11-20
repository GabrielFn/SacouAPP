import { Text as NativeText, type TextProps as NativeTextProps } from "react-native";

import { useTheme } from "../theme/theme-context";
import { fontFamilies } from "../theme/tokens.data";
import { TEXT_SCALING_PROPS } from "./text-scaling";

export type TextVariant = "display" | "title" | "body" | "bodyStrong" | "caption" | "muted";
export type DisplaySize =
  | "displayBlock"
  | "displayBrand"
  | "displayMedium"
  | "displayTitleSmall"
  | "displayTitle"
  | "displayTitleLarge"
  | "displayScore"
  | "displayLevel"
  | "displayLevelCard"
  | "displayLevelBadge"
  | "summaryTitle"
  | "displayMvp";

export interface TextProps extends NativeTextProps {
  readonly variant?: TextVariant;
  readonly displaySize?: DisplaySize;
  readonly tabular?: boolean;
}

export function Text({
  variant = "body",
  displaySize = "displayBlock",
  tabular = false,
  style,
  ...rest
}: TextProps) {
  const { colors, tokens } = useTheme();
  const looks = {
    display: {
      fontFamily: fontFamilies.display800,
      fontSize: tokens.fontSizes[displaySize],
      color: colors.text,
    },
    title: {
      fontFamily: fontFamilies.body700,
      fontSize: tokens.fontSizes.button,
      color: colors.text,
    },
    bodyStrong: {
      fontFamily: fontFamilies.body600,
      fontSize: tokens.fontSizes.body,
      color: colors.text,
    },
    caption: {
      fontFamily: fontFamilies.body400,
      fontSize: tokens.fontSizes.caption,
      color: colors.textMuted,
    },
    muted: {
      fontFamily: fontFamilies.body400,
      fontSize: tokens.fontSizes.small,
      color: colors.textMuted,
    },
    body: {
      fontFamily: fontFamilies.body400,
      fontSize: tokens.fontSizes.body,
      color: colors.text,
    },
  };
  return (
    <NativeText
      {...TEXT_SCALING_PROPS}
      style={[looks[variant], tabular ? { fontVariant: ["tabular-nums"] } : null, style]}
      {...rest}
    />
  );
}
