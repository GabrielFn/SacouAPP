import { View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { Button } from "../../../ui/Button";
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
  const { tokens } = useTheme();
  return (
    <View style={{ gap: tokens.spacing.s }}>
      <Button label={texts.groupAction} variant="dangerOutline" onPress={onPress} />
      <Text variant="muted" style={{ textAlign: "center" }}>
        {texts.groupActionHelp}
      </Text>
    </View>
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
