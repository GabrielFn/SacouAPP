import { View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { BottomSheet } from "../../../ui/BottomSheet";
import { Chip } from "../../../ui/Chip";
import { pickableDates } from "../model/round-dates";

export interface DatePickerSheetProps {
  readonly visible: boolean;
  /** The first of the 14 dates: the day the group plays next. */
  readonly firstDate: string;
  readonly selected: string;
  readonly onPick: (date: string) => void;
  readonly onClose: () => void;
}

/** The next 14 dates in chips, one touch to choose (D4). */
export function DatePickerSheet({
  visible,
  firstDate,
  selected,
  onPick,
  onClose,
}: DatePickerSheetProps) {
  const { tokens } = useTheme();
  return (
    <BottomSheet visible={visible} title={strings.rounds.create.pickDay} onClose={onClose}>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={strings.rounds.create.pickDay}
        style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.s }}
      >
        {pickableDates(firstDate).map((option) => (
          <Chip
            key={option.date}
            label={option.label}
            selected={option.date === selected}
            onPress={() => {
              onPick(option.date);
            }}
          />
        ))}
      </View>
    </BottomSheet>
  );
}
