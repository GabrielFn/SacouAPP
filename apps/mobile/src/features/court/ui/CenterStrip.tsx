import { Pressable, View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { fontFamilies } from "../../../theme/tokens.data";
import { Text } from "../../../ui/Text";
import { COURT_FLEX_WEIGHTS, DISABLED_OPACITY, STRIP_FLEX } from "../court.data";
import { PencilIcon, UndoIcon } from "./CourtIcons";
import { NetMesh } from "./NetMesh";

export interface CenterStripProps {
  readonly hint: string;
  readonly canUndo: boolean;
  readonly onUndo: () => void;
  readonly onCorrect: () => void;
}

/** The net, DESFAZER and Corrigir, and the line that says what the court is showing. */
export function CenterStrip({ hint, canUndo, onUndo, onCorrect }: CenterStripProps) {
  const { colors, tokens } = useTheme();
  const { sizes } = tokens.court;
  return (
    <View
      style={{
        flex: COURT_FLEX_WEIGHTS.strip,
        borderTopWidth: tokens.court.borderWidths.frame,
        borderBottomWidth: tokens.court.borderWidths.frame,
        borderColor: colors.text,
        backgroundColor: colors.background,
      }}
    >
      <NetMesh />
      <View
        style={{
          flexDirection: "row",
          gap: tokens.spacing.s,
          paddingTop: tokens.spacing.s6,
          paddingHorizontal: tokens.spacing.m,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={strings.court.strip.undo}
          accessibilityState={{ disabled: !canUndo }}
          disabled={!canUndo}
          onPress={onUndo}
          style={{
            flex: STRIP_FLEX.undo,
            minHeight: sizes.undoButton,
            borderRadius: tokens.radii.button,
            backgroundColor: colors.text,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: tokens.spacing.s10,
            opacity: canUndo ? 1 : DISABLED_OPACITY,
          }}
        >
          <UndoIcon />
          <Text
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
            flex: STRIP_FLEX.correct,
            minHeight: sizes.undoButton,
            borderRadius: tokens.radii.button,
            borderWidth: tokens.court.borderWidths.outline,
            borderColor: colors.text,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: tokens.spacing.s6,
          }}
        >
          <PencilIcon />
          <Text style={{ fontFamily: fontFamilies.body700, fontSize: tokens.fontSizes.body }}>
            {strings.court.strip.correct}
          </Text>
        </Pressable>
      </View>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text
          numberOfLines={1}
          accessibilityLiveRegion="polite"
          style={{
            color: colors.textMuted,
            fontFamily: fontFamilies.body600,
            fontSize: tokens.fontSizes.small,
          }}
        >
          {hint}
        </Text>
      </View>
    </View>
  );
}
