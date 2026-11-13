import { Pressable, View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { fontFamilies } from "../../../theme/tokens.data";
import { Text } from "../../../ui/Text";
import { DISABLED_OPACITY, HALF, LANDSCAPE_WIDTH_WEIGHTS, NET_COLUMN_FLEX } from "../court.data";
import { PencilIcon, UndoIcon } from "./CourtIcons";
import { NetMesh } from "./NetMesh";

export interface NetColumnProps {
  readonly canUndo: boolean;
  readonly onUndo: () => void;
  readonly onCorrect: () => void;
}

/** The net of the court on its side: a strip between the zones with DESFAZER tall and Corrigir below it. */
export function NetColumn({ canUndo, onUndo, onCorrect }: NetColumnProps) {
  const { colors, tokens } = useTheme();
  const { sizes } = tokens.court;
  return (
    <View
      style={{
        flex: LANDSCAPE_WIDTH_WEIGHTS.net,
        borderLeftWidth: tokens.court.borderWidths.frame,
        borderRightWidth: tokens.court.borderWidths.frame,
        borderColor: colors.text,
        backgroundColor: colors.background,
        gap: tokens.spacing.s,
        paddingVertical: tokens.spacing.s10,
        paddingHorizontal: tokens.court.spacing.hairGap,
      }}
    >
      <NetMesh orientation="vertical" />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={strings.court.strip.undo}
        accessibilityState={{ disabled: !canUndo }}
        disabled={!canUndo}
        onPress={onUndo}
        style={{
          flex: NET_COLUMN_FLEX.undo,
          minHeight: sizes.undoButton,
          minWidth: sizes.menuButton,
          borderRadius: tokens.radii.button,
          backgroundColor: colors.text,
          alignItems: "center",
          justifyContent: "center",
          gap: tokens.spacing.s6,
          opacity: canUndo ? 1 : DISABLED_OPACITY,
        }}
      >
        <UndoIcon />
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{
            color: colors.background,
            fontFamily: fontFamilies.display800,
            fontSize: tokens.fontSizes.displayBrand,
          }}
        >
          {strings.court.strip.undo}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={strings.court.strip.correct}
        onPress={onCorrect}
        style={{
          flex: NET_COLUMN_FLEX.correct,
          minHeight: sizes.menuButton,
          minWidth: sizes.menuButton,
          borderRadius: tokens.radii.button,
          borderWidth: tokens.court.borderWidths.outline,
          borderColor: colors.text,
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
          gap: tokens.court.spacing.hairGap / HALF,
        }}
      >
        <PencilIcon />
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{ fontFamily: fontFamilies.body700, fontSize: tokens.fontSizes.body }}
        >
          {strings.court.strip.correct}
        </Text>
      </Pressable>
    </View>
  );
}
