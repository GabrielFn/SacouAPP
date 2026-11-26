import { useState } from "react";
import { Pressable, View } from "react-native";

import type { ReportReason } from "../../../services/api/sacou-api";
import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { BottomSheet } from "../../../ui/BottomSheet";
import { Button } from "../../../ui/Button";
import { ErrorStrip } from "../../../ui/ErrorStrip";
import { RadioDot } from "../../../ui/RadioDot";
import { Text } from "../../../ui/Text";
import {
  REPORT_REASONS,
  reasonLabel,
  reportTitle,
  type ReportFlow,
  type ReportTarget,
} from "../model/report";

const texts = strings.report;

export interface ReasonOptionProps {
  readonly reason: ReportReason;
  readonly selected: boolean;
  readonly disabled: boolean;
  readonly onSelect: (reason: ReportReason) => void;
}

/** One radio of the list: the dot and the text are the touch target, never under 44. */
function ReasonOption({ reason, selected, disabled, onSelect }: ReasonOptionProps) {
  const { colors, tokens } = useTheme();
  const label = reasonLabel(reason);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={() => {
        onSelect(reason);
      }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.spacing.m,
        minHeight: tokens.sizes.minTouchTarget,
        paddingVertical: tokens.spacing.s,
        borderTopWidth: tokens.borderWidths.thin,
        borderTopColor: colors.borderDivider,
      }}
    >
      <RadioDot selected={selected} />
      <Text variant="bodyStrong" style={{ flex: 1 }}>
        {label}
      </Text>
    </Pressable>
  );
}

export interface ReportSheetProps {
  /** A member of the list (sheet 19c) or the group (screen 18): the title and the body follow it. */
  readonly target: ReportTarget;
  /** The report is on its way (the status of the mutation): the choices and the button wait. */
  readonly pending: boolean;
  /** The text of the refused or failed call; the sheet stays open with the reason chosen. */
  readonly errorText: string | null;
  readonly onSubmit: (reason: ReportReason) => void;
  readonly onClose: () => void;
}

/**
 * "Denunciar" (E6.6): one of the four reasons and "Enviar denúncia", off until a reason is chosen. Mounted only while
 * open, so the reason (its one field, `useState`, frontend.md rule 4) starts empty each time.
 */
export function ReportSheet({ target, pending, errorText, onSubmit, onClose }: ReportSheetProps) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  return (
    <BottomSheet visible title={reportTitle(target)} closeLabel={texts.close} onClose={onClose}>
      <Text variant="muted">{texts.intro}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={texts.reasonsLabel}>
        {REPORT_REASONS.map((option) => (
          <ReasonOption
            key={option}
            reason={option}
            selected={option === reason}
            disabled={pending}
            onSelect={setReason}
          />
        ))}
      </View>
      {errorText === null ? null : <ErrorStrip text={errorText} />}
      <Button
        label={texts.submit}
        variant="danger"
        disabled={reason === null || pending}
        busy={pending}
        onPress={() => {
          if (reason !== null) onSubmit(reason);
        }}
      />
    </BottomSheet>
  );
}

export interface ReportDialogProps {
  readonly report: ReportFlow;
  readonly onClose: () => void;
}

/** The sheet of a screen's report flow, mounted only while it has a target (screens 19 and 18). */
export function ReportDialog({ report, onClose }: ReportDialogProps) {
  if (report.target === null) return null;
  return (
    <ReportSheet
      target={report.target}
      pending={report.pending}
      errorText={report.errorText}
      onSubmit={report.send}
      onClose={onClose}
    />
  );
}
