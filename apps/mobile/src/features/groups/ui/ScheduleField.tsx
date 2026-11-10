import { Pressable, View } from "react-native";

import { useTheme } from "../../../theme/theme-context";
import { fontFamilies } from "../../../theme/tokens.data";
import { Text } from "../../../ui/Text";

export interface ScheduleFieldProps {
  readonly label: string;
  /** "Terça, 20h30", or the placeholder while nothing is chosen. */
  readonly valueText: string;
  readonly chosen: boolean;
  readonly error?: string;
  readonly onPress: () => void;
}

/** The "Dia e horário" button that looks like a field and opens the sheet. */
export function ScheduleField({ label, valueText, chosen, error, onPress }: ScheduleFieldProps) {
  const { colors, tokens } = useTheme();
  return (
    <View style={{ gap: tokens.spacing.xs }}>
      <Text variant="bodyStrong" style={{ fontSize: tokens.fontSizes.small }}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${valueText}`}
        onPress={onPress}
        style={{
          minHeight: tokens.sizes.field,
          justifyContent: "center",
          borderRadius: tokens.radii.field,
          borderWidth: tokens.borderWidths.thin,
          borderColor: error ? colors.primary : colors.borderField,
          backgroundColor: colors.surface,
          paddingHorizontal: tokens.spacing.m,
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            color: chosen ? colors.text : colors.textMuted,
            fontFamily: fontFamilies.body600,
            fontSize: tokens.fontSizes.field,
          }}
        >
          {valueText}
        </Text>
      </Pressable>
      {error ? (
        <Text variant="caption" accessibilityRole="alert" style={{ color: colors.text }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
