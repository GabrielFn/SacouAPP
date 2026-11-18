import { Pressable } from "react-native";

import { useTheme } from "../../../theme/theme-context";
import { Avatar } from "../../../ui/Avatar";
import { Text } from "../../../ui/Text";

export interface PickRowProps {
  readonly name: string;
  /** "DU" in the round avatar of the design; `null` draws the neutral one. */
  readonly initials: string | null;
  readonly detail: string | null;
  readonly checked: boolean;
  readonly disabled?: boolean;
  readonly accessibilityLabel: string;
  readonly onPress: () => void;
}

/**
 * One choice of a list of the court (screens 23a and 31): a radio with the name and a detail. The
 * chosen one is drawn in the colors of the text swapped, which keeps contrast AA in both themes; an
 * option that cannot be chosen is muted by color and a dashed border, never by opacity.
 */
export function PickRow({
  name,
  initials,
  detail,
  checked,
  disabled = false,
  accessibilityLabel,
  onPress,
}: PickRowProps) {
  const { colors, tokens } = useTheme();
  const idle = disabled ? colors.textMuted : colors.text;
  const foreground = checked ? colors.background : idle;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: tokens.sizes.minTouchTarget,
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.spacing.s,
        paddingHorizontal: tokens.spacing.s10,
        borderRadius: tokens.radii.field,
        borderWidth: tokens.borderWidths.thin,
        borderColor: idle,
        borderStyle: disabled ? "dashed" : "solid",
        backgroundColor: checked ? colors.text : colors.surface,
      }}
    >
      <Avatar initials={initials} dashed={false} />
      <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1, color: foreground }}>
        {name}
      </Text>
      {detail === null ? null : (
        <Text
          variant="muted"
          numberOfLines={1}
          style={{ marginLeft: "auto", flexShrink: 1, color: foreground }}
        >
          {detail}
        </Text>
      )}
    </Pressable>
  );
}
