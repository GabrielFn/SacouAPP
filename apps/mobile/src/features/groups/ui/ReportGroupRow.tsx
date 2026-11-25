import { Pressable, View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { ChevronRightIcon } from "../../../ui/Icons";
import { Text } from "../../../ui/Text";
import { useGroupReport } from "../hooks/use-group-report";
import { ReportSentNotice } from "./ReportSentNotice";
import { ReportDialog } from "./ReportSheet";

const texts = strings.report;

export interface ReportGroupRowProps {
  readonly onPress: () => void;
}

/** "Denunciar grupo", the last line of screen 18 (E6.6, question 232): opens the sheet of the reasons. */
export function ReportGroupRow({ onPress }: ReportGroupRowProps) {
  const { colors, tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={texts.groupAction}
      accessibilityHint={texts.groupActionHelp}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.spacing.s,
        minHeight: tokens.sizes.settingRowMin,
        paddingHorizontal: tokens.spacing.m,
        borderRadius: tokens.radii.tile,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.borderCard,
        backgroundColor: colors.surface,
      }}
    >
      <View style={{ flex: 1, gap: tokens.spacing.xs }}>
        <Text variant="bodyStrong" style={{ color: colors.danger }}>
          {texts.groupAction}
        </Text>
        <Text variant="caption">{texts.groupActionHelp}</Text>
      </View>
      <ChevronRightIcon color={colors.textMuted} />
    </Pressable>
  );
}

export interface GroupReportSectionProps {
  readonly groupId: string;
}

/** The end of screen 18: the line, "Denúncia enviada" after a report, and the sheet while it is open. */
export function GroupReportSection({ groupId }: GroupReportSectionProps) {
  const report = useGroupReport(groupId);
  if (!report.canReport) return null;
  return (
    <>
      <ReportSentNotice visible={report.sent} />
      <ReportGroupRow onPress={report.open} />
      <ReportDialog report={report} onClose={report.close} />
    </>
  );
}
