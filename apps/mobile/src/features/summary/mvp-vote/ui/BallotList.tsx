import { View } from "react-native";

import { strings } from "../../../../strings/pt-BR";
import { useTheme } from "../../../../theme/theme-context";
import type { BallotRowView } from "../model/mvp-vote-view";
import { BallotRow } from "./BallotRow";

export interface BallotListProps {
  readonly rows: readonly BallotRowView[];
  readonly disabled: boolean;
  readonly onSelect: (memberId: string) => void;
}

/** The ballot (VotarMvp.dc.html .list): one choice only, nothing chosen at first (question 171). */
export function BallotList({ rows, disabled, onSelect }: BallotListProps) {
  const { colors, tokens } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={strings.mvpVote.ballotLabel}
      style={{
        backgroundColor: colors.surface,
        borderRadius: tokens.radii.tile,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.borderCard,
        overflow: "hidden",
      }}
    >
      {rows.map((row, index) => (
        <BallotRow
          key={row.memberId}
          row={row}
          first={index === 0}
          disabled={disabled}
          onSelect={onSelect}
        />
      ))}
    </View>
  );
}
