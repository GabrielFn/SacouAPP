import { Pressable, View } from "react-native";

import { useTheme } from "../../../../theme/theme-context";
import { Avatar } from "../../../../ui/Avatar";
import { RadioDot } from "../../../../ui/RadioDot";
import { Text } from "../../../../ui/Text";
import type { BallotRowView } from "../model/mvp-vote-view";

export interface BallotRowProps {
  readonly row: BallotRowView;
  readonly first: boolean;
  readonly disabled: boolean;
  readonly onSelect: (memberId: string) => void;
}

/** One candidate (VotarMvp.dc.html .vt): the whole row is the radio, taller than the touch floor. */
export function BallotRow({ row, first, disabled, onSelect }: BallotRowProps) {
  const { colors, tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`${row.name}, ${row.line}`}
      accessibilityState={{ checked: row.selected, disabled }}
      disabled={disabled}
      onPress={() => {
        onSelect(row.memberId);
      }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.spacing.s10,
        minHeight: tokens.sizes.ballotRowMin,
        paddingLeft: tokens.spacing.m,
        paddingRight: tokens.spacing.s14,
        paddingVertical: tokens.spacing.s6,
        backgroundColor: row.selected ? colors.choiceFill : colors.surface,
        borderTopWidth: first ? 0 : tokens.borderWidths.thin,
        borderTopColor: colors.borderDivider,
      }}
    >
      <Avatar initials={row.initials} dashed={false} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {row.name}
        </Text>
        <Text variant="caption" numberOfLines={1} style={{ color: colors.textMuted }}>
          {row.line}
        </Text>
      </View>
      <RadioDot selected={row.selected} />
    </Pressable>
  );
}
