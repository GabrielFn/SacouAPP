import { Pressable, View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { fontFamilies } from "../../../theme/tokens.data";
import { PlusIcon } from "../../../ui/Icons";
import { Text } from "../../../ui/Text";

const { name, line } = strings.settings.templates["do-zero"];

export interface FromScratchLinkProps {
  readonly onPress: () => void;
}

/** "Do zero" of screen 04: the dashed button that opens screen 04a. It is not a radio option. */
export function FromScratchLink({ onPress }: FromScratchLinkProps) {
  const { colors, tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${line}`}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.spacing.s14,
        padding: tokens.spacing.s14,
        minHeight: tokens.sizes.templateOptionZeroMin,
        borderRadius: tokens.radii.tile,
        borderWidth: tokens.borderWidths.thin,
        borderStyle: "dashed",
        borderColor: colors.borderDashed,
      }}
    >
      <PlusIcon />
      <View style={{ flex: 1, gap: tokens.spacing.xs }}>
        <Text variant="title" style={{ fontSize: tokens.fontSizes.field }}>
          {name}
        </Text>
        <Text variant="muted" style={{ fontFamily: fontFamilies.body400 }}>
          {line}
        </Text>
      </View>
    </Pressable>
  );
}
