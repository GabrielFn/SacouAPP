import type { MemberId, TeamSide } from "@sacou/match-engine";
import { ScrollView, useWindowDimensions, View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { Button } from "../../../ui/Button";
import { SegmentedControl } from "../../../ui/SegmentedControl";
import { Text } from "../../../ui/Text";
import type { SubstitutionRow, SubstitutionView } from "../substitution/substitution-selectors";
import { CourtPage } from "./CourtPage";
import { PickRow } from "./PickRow";

export interface SubstitutionScreenProps {
  readonly view: SubstitutionView;
  readonly refusal: string | null;
  readonly onClose: () => void;
  readonly onChooseTeam: (team: TeamSide) => void;
  readonly onChooseOutgoing: (memberId: MemberId) => void;
  readonly onChooseIncoming: (memberId: MemberId) => void;
  readonly onConfirm: () => void;
}

export interface PickColumnProps {
  readonly title: string;
  readonly rows: readonly SubstitutionRow[];
  readonly onPick: (memberId: MemberId) => void;
}

function PickColumn({ title, rows, onPick }: PickColumnProps) {
  const { tokens } = useTheme();
  return (
    <View style={{ flex: 1, gap: tokens.spacing.s }}>
      <Text variant="bodyStrong" accessibilityRole="header">
        {title}
      </Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={title}
        style={{ gap: tokens.spacing.xs }}
      >
        {rows.map((row) => (
          <PickRow
            key={row.memberId}
            name={row.name}
            detail={row.detail}
            checked={row.selected}
            accessibilityLabel={row.accessibilityLabel}
            onPress={() => {
              onPick(row.memberId);
            }}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * Screen 23a: who goes out of the court and who of the bench comes in. On its side it has two
 * columns, "Sai" and "Entra" (question 78); the queue is never offered (question 79).
 */
export function SubstitutionScreen({
  view,
  refusal,
  onClose,
  onChooseTeam,
  onChooseOutgoing,
  onChooseIncoming,
  onConfirm,
}: SubstitutionScreenProps) {
  const { substitution } = strings.courtPlayers;
  const { colors, tokens } = useTheme();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  return (
    <CourtPage
      title={substitution.title}
      subtitle={null}
      closeLabel={substitution.close}
      onClose={onClose}
    >
      <ScrollView
        contentContainerStyle={{ gap: tokens.spacing.m, paddingBottom: tokens.spacing.xl }}
      >
        {view.teams.length > 1 ? (
          <SegmentedControl
            accessibilityLabel={substitution.teamLabel}
            selected={view.team}
            onSelect={onChooseTeam}
            options={view.teams.map(({ side, label }) => ({ value: side, label }))}
          />
        ) : null}
        <View style={{ flexDirection: landscape ? "row" : "column", gap: tokens.spacing.l }}>
          <PickColumn
            title={substitution.outgoing}
            rows={view.outgoing}
            onPick={onChooseOutgoing}
          />
          <PickColumn
            title={substitution.incoming}
            rows={view.incoming}
            onPick={onChooseIncoming}
          />
        </View>
        <Text accessibilityLiveRegion="polite">{view.sentence ?? substitution.pickBoth}</Text>
        {refusal === null ? null : (
          <Text accessibilityLiveRegion="polite" style={{ color: colors.refusal }}>
            {refusal}
          </Text>
        )}
        <Button
          label={view.confirmLabel ?? substitution.title}
          disabled={view.picks === null}
          onPress={onConfirm}
        />
      </ScrollView>
    </CourtPage>
  );
}
