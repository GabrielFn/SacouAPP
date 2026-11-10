import { View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { BottomSheet } from "../../../ui/BottomSheet";
import { Button } from "../../../ui/Button";
import { Chip } from "../../../ui/Chip";
import { Text } from "../../../ui/Text";
import { TextField } from "../../../ui/TextField";
import { weekdayName } from "../model/schedule-text";

const { sheets } = strings.settings;
const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
const TIME_MAX_LENGTH = 5;

export interface ScheduleSheetProps {
  readonly visible: boolean;
  readonly weekday: number;
  readonly time: string;
  /** The refusal of the time typed, when there is one. */
  readonly error?: string;
  readonly onWeekdayChange: (weekday: number) => void;
  readonly onTimeChange: (time: string) => void;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/** Day of the week in chips and the time in `HH:mm`, with confirm and cancel (D3). */
export function ScheduleSheet({
  visible,
  weekday,
  time,
  error,
  onWeekdayChange,
  onTimeChange,
  onConfirm,
  onCancel,
}: ScheduleSheetProps) {
  const { tokens } = useTheme();
  return (
    <BottomSheet visible={visible} title={strings.createGroup.step2.schedule} onClose={onCancel}>
      <View style={{ gap: tokens.spacing.s }}>
        <Text variant="bodyStrong">{sheets.weekday}</Text>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={sheets.weekday}
          style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.s6 }}
        >
          {ISO_WEEKDAYS.map((day) => (
            <Chip
              key={day}
              label={weekdayName(day)}
              selected={day === weekday}
              onPress={() => {
                onWeekdayChange(day);
              }}
            />
          ))}
        </View>
      </View>
      <TextField
        label={sheets.time}
        value={time}
        onChangeText={onTimeChange}
        placeholder={sheets.timePlaceholder}
        keyboardType="numbers-and-punctuation"
        maxLength={TIME_MAX_LENGTH}
        error={error}
      />
      <Button label={sheets.confirm} onPress={onConfirm} />
      <Button label={sheets.cancel} variant="link" onPress={onCancel} />
    </BottomSheet>
  );
}
