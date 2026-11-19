import type { ReactNode } from "react";
import type { RotationDirection, TeamSide } from "@sacou/match-engine";
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { fontFamilies } from "../../../theme/tokens.data";
import { Text } from "../../../ui/Text";
import type {
  RevertSheetModel,
  ShiftOption,
  TimelineRowModel,
} from "../corrections/corrections-selectors";
import type { CorrectionsState } from "../corrections/corrections.reducer";
import { CourtPage } from "./CourtPage";
import { RotateTeamIcon, SwitchServerIcon } from "./MenuIcons";
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
  /** Why tapping the newest point picked nothing (it is the score now), or `null`. */
  readonly currentNotice: string | null;
  /** Why the last command was turned down, or `null`. */
  readonly refusal: string | null;
  readonly onClose: () => void;
  readonly onPointTapped: (eventId: string) => void;
  /** "Autor" of a line, with "Ponto individual" on (D10). */
  readonly onAuthor?: (eventId: string) => void;
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
      {props.currentNotice === null ? null : (
        <Text accessibilityLiveRegion="polite">{props.currentNotice}</Text>
      )}
      {props.servingNotice === null ? null : (
        <Text accessibilityLiveRegion="polite">{props.servingNotice}</Text>
      )}
      {props.refusal === null ? null : (
        <Text accessibilityLiveRegion="polite" style={{ color: colors.refusal }}>
          {props.refusal}
        </Text>
      )}
    </>
  );
}

export interface QuickActionProps {
  readonly label: string;
  readonly disabled?: boolean;
  readonly renderIcon: (color: string) => ReactNode;
  readonly onPress: () => void;
}

/** One of the two outline buttons under the title (Corrigir.dc.html .qa): 44 high, icon and label. */
function QuickAction({ label, disabled = false, renderIcon, onPress }: QuickActionProps) {
  const { colors, tokens } = useTheme();
  const color = disabled ? colors.textMuted : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: tokens.sizes.chip,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: tokens.spacing.s6,
        borderRadius: tokens.radii.field,
        borderWidth: tokens.borderWidths.thin,
        borderColor: color,
        paddingHorizontal: tokens.spacing.s,
      }}
    >
      {renderIcon(color)}
      <Text
        numberOfLines={1}
        style={{ color, fontFamily: fontFamilies.body700, fontSize: tokens.fontSizes.small }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function MainPanel(props: CorrectionsScreenProps) {
  const { corrections } = strings.court;
  const { tokens } = useTheme();
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
    <View style={{ flexDirection: "row", gap: tokens.spacing.s }}>
      <QuickAction
        label={corrections.switchServer}
        disabled={!props.canSwitchServer}
        renderIcon={(color) => <SwitchServerIcon color={color} />}
        onPress={props.onSwitchServer}
      />
      {props.canShift ? (
        <QuickAction
          label={corrections.shiftTeam}
          renderIcon={(color) => <RotateTeamIcon color={color} />}
          onPress={props.onOpenShift}
        />
      ) : null}
    </View>
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
      sheet
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
          <Text variant="caption" style={{ fontFamily: fontFamilies.body600 }}>
            {corrections.listHint}
          </Text>
          <ScrollView
            accessibilityLabel={
              props.setNumber === null ? undefined : corrections.listLabel(props.setNumber)
            }
            contentContainerStyle={{ gap: tokens.spacing.xs, paddingBottom: tokens.spacing.xl }}
          >
            {rows.length === 0 ? <Text variant="muted">{corrections.empty}</Text> : null}
            {rows.map((row) => (
              <TimelineRow
                key={row.eventId}
                row={row}
                onPress={props.onPointTapped}
                {...(props.onAuthor === undefined ? {} : { onAuthor: props.onAuthor })}
              />
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
