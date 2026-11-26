import { View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { Text } from "../../../ui/Text";

export interface ReportSentNoticeProps {
  /** The last report went through (the status of its mutation). */
  readonly visible: boolean;
}

/** "Denúncia enviada. O Sacou vai analisar." after the sheet closes (E6.6), announced politely. Drawing only. */
export function ReportSentNotice({ visible }: ReportSentNoticeProps) {
  const { colors, tokens } = useTheme();
  if (!visible) return null;
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        padding: tokens.spacing.m,
        borderRadius: tokens.radii.field,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.borderCard,
        backgroundColor: colors.surface,
      }}
    >
      <Text variant="bodyStrong">{strings.report.sent}</Text>
    </View>
  );
}
