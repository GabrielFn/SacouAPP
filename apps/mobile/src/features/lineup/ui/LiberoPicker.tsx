import type { MemberId } from "@sacou/match-engine";
import { View } from "react-native";

import { lineupStrings as texts } from "../../../strings/lineup.pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { SegmentBar } from "../../../ui/SegmentBar";
import { Text } from "../../../ui/Text";
import type { LiberoRow } from "../model/lineup-selectors";

/** `null` is "Sem líbero", a value the segment bar cannot key on. */
const NO_LIBERO = "";

export interface LiberoPickerProps {
  readonly row: LiberoRow;
  readonly onSelect: (memberId: MemberId | null) => void;
}

/** The row "Líbero" (D5): "Sem líbero" and who can be the libero, or why nobody can. */
export function LiberoPicker({ row, onSelect }: LiberoPickerProps) {
  const { tokens } = useTheme();
  const checked = row.options.find((option) => option.checked)?.value ?? null;
  return (
    <View style={{ gap: tokens.spacing.s6 }}>
      <Text variant="bodyStrong">{texts.libero}</Text>
      {row.note === null ? (
        <SegmentBar<MemberId>
          role="radios"
          options={row.options.map((option) => ({
            value: option.value ?? NO_LIBERO,
            label: option.label,
          }))}
          selected={checked ?? NO_LIBERO}
          accessibilityLabel={row.label}
          onSelect={(value) => {
            onSelect(value === NO_LIBERO ? null : value);
          }}
        />
      ) : (
        <Text variant="muted">{row.note}</Text>
      )}
    </View>
  );
}
