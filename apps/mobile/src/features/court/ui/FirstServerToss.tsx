import type { TeamSide } from "@sacou/match-engine";
import { View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { Button } from "../../../ui/Button";
import { SegmentedControl } from "../../../ui/SegmentedControl";
import { Text } from "../../../ui/Text";

/** Nothing picked yet: the radio group shows no side checked. */
const NO_TOSS = "none";

export interface FirstServerTossProps {
  readonly labels: Readonly<Record<TeamSide, string>>;
  readonly toss: TeamSide | null;
  readonly onChoose: (side: TeamSide) => void;
  readonly onDraw: () => void;
}

/** "Saca primeiro" of the deciding set, as on sheet 08: pick a side, or "Sortear". */
export function FirstServerToss({ labels, toss, onChoose, onDraw }: FirstServerTossProps) {
  const { setEnd } = strings.court;
  const { tokens } = useTheme();
  return (
    <View style={{ gap: tokens.spacing.s6 }}>
      <Text variant="bodyStrong">{setEnd.servesFirst}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s }}>
        <View style={{ flex: 1 }}>
          <SegmentedControl<TeamSide | typeof NO_TOSS>
            options={[
              { value: "a", label: setEnd.tossOption("A", labels.a) },
              { value: "b", label: setEnd.tossOption("B", labels.b) },
            ]}
            selected={toss ?? NO_TOSS}
            accessibilityLabel={setEnd.servesFirst}
            onSelect={(side) => {
              if (side !== NO_TOSS) onChoose(side);
            }}
          />
        </View>
        <Button label={setEnd.draw} variant="outline" onPress={onDraw} />
      </View>
    </View>
  );
}
