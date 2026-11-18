import type { FormationSystem } from "@sacou/volley-rules";

import { useTheme } from "../../../theme/theme-context";
import { RadioTiles } from "../../../ui/RadioTiles";
import type { Option } from "../model/pre-game-selectors";

const OPTION_FLEX_BASIS = "22%";

export interface RotationPickerProps {
  readonly label: string;
  readonly options: readonly Option<FormationSystem>[];
  readonly selected: FormationSystem;
  readonly disabled: boolean;
  readonly onSelect: (system: FormationSystem) => void;
}

/** The systems of one team (PreJogo.dc.html radiogroup): one "Livre", no "6x0" nor "Pro" (D9). */
export function RotationPicker({
  label,
  options,
  selected,
  disabled,
  onSelect,
}: RotationPickerProps) {
  const { tokens } = useTheme();
  return (
    <RadioTiles<FormationSystem>
      label={label}
      options={options}
      selected={selected}
      disabled={disabled}
      onSelect={onSelect}
      tileHeight={tokens.sizes.systemButton}
      basis={OPTION_FLEX_BASIS}
    />
  );
}
