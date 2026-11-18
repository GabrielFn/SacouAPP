import type { RotationSlot } from "@sacou/volley-rules";

import { lineupStrings as texts } from "../../../strings/lineup.pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { RadioTiles } from "../../../ui/RadioTiles";
import type { Choice } from "../model/lineup-selectors";

/** No basis: the six share the row (Escalacao.dc.html, `repeat(6, 1fr)`). */
const SHARED_ROW = 0;

export interface RotationSelectorProps {
  readonly label: string;
  readonly options: readonly Choice<RotationSlot>[];
  readonly onSelect: (zone: RotationSlot) => void;
}

/** "Rotação 1…6" (Escalacao.dc.html radiogroup): the zone of the setter, absolute (D4). */
export function RotationSelector({ label, options, onSelect }: RotationSelectorProps) {
  const { tokens } = useTheme();
  const checked = options.find((option) => option.checked)?.value;
  if (checked === undefined) return null;
  return (
    <RadioTiles<RotationSlot>
      label={label}
      options={options.map((option) => ({
        value: option.value,
        label: option.label,
        accessibilityLabel: texts.rotationOption(option.value),
      }))}
      selected={checked}
      onSelect={onSelect}
      tileHeight={tokens.sizes.segment}
      basis={SHARED_ROW}
    />
  );
}
