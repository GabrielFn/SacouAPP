import { View } from "react-native";

import { useTheme } from "../../../theme/theme-context";
import { StatusPill } from "../../../ui/StatusPill";
import { Text } from "../../../ui/Text";
import type { RoundCardModel } from "../model/round-cards";

export interface RoundCardStatusProps {
  readonly round: RoundCardModel;
}

/** The foot of a round card: your pill ("Vou", "Na espera · 2º", "Lista cheia") and the count. */
export function RoundCardStatus({ round }: RoundCardStatusProps) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        marginTop: "auto",
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        gap: tokens.spacing.s,
        paddingTop: tokens.spacing.xs,
      }}
    >
      {round.pill === null ? null : (
        <StatusPill label={round.pill.label} status={round.pill.kind} />
      )}
      <Text variant="muted" tabular>
        {round.countText}
      </Text>
    </View>
  );
}
