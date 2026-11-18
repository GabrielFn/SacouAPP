import { Pressable, View } from "react-native";

import { useTheme } from "../theme/theme-context";
import { Text } from "./Text";

export interface RadioTile<T> {
  readonly value: T;
  readonly label: string;
  /** What the screen reader says, when it is more than the label ("Rotação 2"). */
  readonly accessibilityLabel?: string;
}

export interface RadioTilesProps<T> {
  readonly label: string;
  readonly options: readonly RadioTile<T>[];
  readonly selected: T;
  readonly onSelect: (value: T) => void;
  readonly disabled?: boolean;
  /** The height of a tile, from the tokens: never under the touch floor. */
  readonly tileHeight: number;
  /** The share of the row a tile starts from, so a long row wraps ("22%" on the 08). */
  readonly basis?: number | `${number}%`;
}

/** A row of square radio tiles, the chosen one navy (PreJogo.dc.html systems, Escalacao.dc.html .rot). */
export function RadioTiles<T extends string | number>({
  label,
  options,
  selected,
  onSelect,
  disabled = false,
  tileHeight,
  basis,
}: RadioTilesProps<T>) {
  const { colors, tokens } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.s6 }}
    >
      {options.map((option) => {
        const checked = option.value === selected;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityState={{ checked, disabled }}
            disabled={disabled}
            onPress={() => {
              onSelect(option.value);
            }}
            style={{
              flexGrow: 1,
              flexBasis: basis,
              minHeight: tileHeight,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: tokens.radii.field,
              borderWidth: tokens.borderWidths.thin,
              borderColor: checked ? colors.text : colors.borderChip,
              backgroundColor: checked ? colors.text : colors.surface,
            }}
          >
            <Text
              variant="display"
              displaySize="displayBlock"
              tabular
              style={{ color: checked ? colors.background : colors.text }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
