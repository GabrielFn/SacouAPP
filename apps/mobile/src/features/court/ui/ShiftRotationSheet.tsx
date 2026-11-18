import type { TeamSide } from "@sacou/match-engine";
import { View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { Button } from "../../../ui/Button";
import { Chip } from "../../../ui/Chip";
import { Text } from "../../../ui/Text";
import type { ShiftOption } from "../corrections/corrections-selectors";

export interface ShiftRotationSheetProps {
  readonly options: readonly ShiftOption[];
  readonly team: TeamSide;
  readonly onChooseTeam: (team: TeamSide) => void;
  readonly onShift: (direction: "forward" | "backward") => void;
  readonly onClose: () => void;
}

/** "Girar / desgirar time": picks the team and turns it one place, showing the rotation before and after. */
export function ShiftRotationSheet({
  options,
  team,
  onChooseTeam,
  onShift,
  onClose,
}: ShiftRotationSheetProps) {
  const { corrections } = strings.court;
  const { colors, tokens } = useTheme();
  const chosen = options.find(({ side }) => side === team);
  const rotating = chosen?.zone !== null && chosen !== undefined;
  return (
    <View
      accessibilityViewIsModal
      style={{
        backgroundColor: colors.surface,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.borderCard,
        borderRadius: tokens.radii.tile,
        padding: tokens.spacing.l,
        gap: tokens.spacing.s,
      }}
    >
      <Text variant="display" displaySize="displayBlock" accessibilityRole="header">
        {corrections.shiftTitle}
      </Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={corrections.shiftTeamLabel}
        style={{ flexDirection: "row", gap: tokens.spacing.s }}
      >
        {options.map(({ side, label, zone }) => (
          <Chip
            key={side}
            label={zone === null ? corrections.shiftTeamOff(label) : label}
            selected={side === team}
            disabled={zone === null}
            onPress={() => {
              onChooseTeam(side);
            }}
          />
        ))}
      </View>
      {rotating ? (
        <>
          <Button
            label={corrections.shiftForward}
            accessibilityLabel={corrections.shiftButtonLabel(
              corrections.shiftForward,
              chosen.forwardText ?? "",
            )}
            onPress={() => {
              onShift("forward");
            }}
          />
          <Button
            label={corrections.shiftBackward}
            accessibilityLabel={corrections.shiftButtonLabel(
              corrections.shiftBackward,
              chosen.backwardText ?? "",
            )}
            variant="outline"
            onPress={() => {
              onShift("backward");
            }}
          />
          <Text variant="muted">
            {corrections.shiftBoth(chosen.forwardText ?? "", chosen.backwardText ?? "")}
          </Text>
        </>
      ) : null}
      <Button label={corrections.shiftClose} variant="link" onPress={onClose} />
    </View>
  );
}
