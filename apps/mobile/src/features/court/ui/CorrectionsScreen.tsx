import type { RotationDirection, TeamSide } from "@sacou/match-engine";
import { ScrollView, useWindowDimensions, View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { Button } from "../../../ui/Button";
import { Text } from "../../../ui/Text";
import type {
  RevertSheetModel,
  ShiftOption,
  TimelineRowModel,
} from "../corrections/corrections-selectors";
import type { CorrectionsState } from "../corrections/corrections.reducer";
import { CourtPage } from "./CourtPage";
import { RevertSheet } from "./RevertSheet";
import { ShiftRotationSheet } from "./ShiftRotationSheet";
import { TimelineRow } from "./TimelineRow";

export interface CorrectionsScreenProps {
  readonly subtitle: string | null;
  readonly setNumber: number | null;
  readonly rows: readonly TimelineRowModel[];
  readonly state: CorrectionsState;
  readonly revert: RevertSheetModel | null;
  readonly shiftOptions: readonly ShiftOption[];
  /** Neither team has a rotation: "Girar" is not offered. */
  readonly canShift: boolean;
  readonly canSwitchServer: boolean;
  /** "Agora saca o Azul.", while that was the last thing done. */
  readonly servingNotice: string | null;
  /** Why the last command was turned down, or `null`. */
  readonly refusal: string | null;
  readonly onClose: () => void;
  readonly onPointTapped: (eventId: string) => void;
  readonly onSwitchServer: () => void;
  readonly onOpenShift: () => void;
  readonly onChooseShiftTeam: (team: TeamSide) => void;
  readonly onShift: (direction: RotationDirection) => void;
  readonly onCloseShift: () => void;
  readonly onRevert: () => void;
  readonly onCancelRevert: () => void;
}

/**
 * Screen 24: the points of the set, newest first; the picked one shows what going back to it does.
 * On its side it has two columns (the list and the actions), like the court.
 */
function ActionsColumn(props: CorrectionsScreenProps) {
  const { colors } = useTheme();
  return (
    <>
      <MainPanel {...props} />
      {props.servingNotice === null ? null : (
        <Text accessibilityLiveRegion="polite">{props.servingNotice}</Text>
      )}
      {props.refusal === null ? null : (
        <Text accessibilityLiveRegion="polite" style={{ color: colors.danger }}>
          {props.refusal}
        </Text>
      )}
    </>
  );
}

function MainPanel(props: CorrectionsScreenProps) {
  const { corrections } = strings.court;
  const { state, revert } = props;
  if (state.sheet === "shift") {
    return (
      <ShiftRotationSheet
        options={props.shiftOptions}
        team={state.shiftTeam}
        onChooseTeam={props.onChooseShiftTeam}
        onShift={props.onShift}
        onClose={props.onCloseShift}
      />
    );
  }
  if (revert !== null) {
    return (
      <RevertSheet model={revert} onConfirm={props.onRevert} onCancel={props.onCancelRevert} />
    );
  }
  return (
    <>
      <Button
        label={corrections.switchServer}
        variant="outline"
        disabled={!props.canSwitchServer}
        onPress={props.onSwitchServer}
      />
      {props.canShift ? (
        <Button label={corrections.shiftTeam} variant="outline" onPress={props.onOpenShift} />
      ) : null}
    </>
  );
}

export function CorrectionsScreen(props: CorrectionsScreenProps) {
  const { corrections } = strings.court;
  const { tokens } = useTheme();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const { rows } = props;
  return (
    <CourtPage
      title={corrections.title}
      subtitle={props.subtitle}
      closeLabel={corrections.close}
      onClose={props.onClose}
    >
      <View
        style={{
          flex: 1,
          flexDirection: landscape ? "row" : "column-reverse",
          gap: tokens.spacing.l,
        }}
      >
        <View style={{ flex: 1.2, gap: tokens.spacing.s }}>
          <Text variant="muted">{corrections.listHint}</Text>
          <ScrollView
            accessibilityLabel={
              props.setNumber === null ? undefined : corrections.listLabel(props.setNumber)
            }
            contentContainerStyle={{ gap: tokens.spacing.xs, paddingBottom: tokens.spacing.xl }}
          >
            {rows.length === 0 ? <Text variant="muted">{corrections.empty}</Text> : null}
            {rows.map((row) => (
              <TimelineRow key={row.eventId} row={row} onPress={props.onPointTapped} />
            ))}
          </ScrollView>
        </View>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: tokens.spacing.s, paddingBottom: tokens.spacing.xl }}
        >
          <ActionsColumn {...props} />
        </ScrollView>
      </View>
    </CourtPage>
  );
}
