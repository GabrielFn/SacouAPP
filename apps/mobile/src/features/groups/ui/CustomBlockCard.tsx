import { Pressable, View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { ChevronDownIcon } from "../../../ui/Icons";
import { Switch } from "../../../ui/Switch";
import { Text } from "../../../ui/Text";
import type { CustomBlock } from "../model/custom-blocks";

const { custom } = strings.createGroup;

export interface CustomBlockCardProps {
  readonly block: CustomBlock;
  readonly enabled: boolean;
  readonly expanded: boolean;
  readonly onToggleEnabled: (block: CustomBlock) => void;
  readonly onToggleExpanded: (block: CustomBlock) => void;
}

/** One block of screen 04a: title and summary that open its text, and the switch that turns it on. */
export function CustomBlockCard({
  block,
  enabled,
  expanded,
  onToggleEnabled,
  onToggleExpanded,
}: CustomBlockCardProps) {
  const { colors, tokens } = useTheme();
  const text = custom.blocks[block];
  return (
    <View
      accessibilityLabel={text.title}
      style={{
        backgroundColor: colors.surface,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.borderCard,
        borderRadius: tokens.radii.tile,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          minHeight: tokens.sizes.blockHeaderMin,
          paddingLeft: tokens.spacing.s14,
          paddingRight: tokens.spacing.s6,
          gap: tokens.spacing.s,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={expanded ? custom.collapse(text.title) : custom.expand(text.title)}
          onPress={() => {
            onToggleExpanded(block);
          }}
          style={{
            flex: 1,
            minHeight: tokens.sizes.blockHeaderMin,
            flexDirection: "row",
            alignItems: "center",
            gap: tokens.spacing.s,
            paddingVertical: tokens.spacing.s,
          }}
        >
          <View style={{ flex: 1, gap: tokens.spacing.xs }}>
            <Text variant="title">{text.title}</Text>
            <Text variant="caption">{text.summary}</Text>
          </View>
          <ChevronDownIcon />
        </Pressable>
        <Switch
          accessibilityLabel={text.title}
          checked={enabled}
          onChange={() => {
            onToggleEnabled(block);
          }}
        />
      </View>
      {expanded ? (
        <View
          style={{
            paddingHorizontal: tokens.spacing.s14,
            paddingBottom: tokens.spacing.s14,
          }}
        >
          <Text variant="caption">{text.detail}</Text>
        </View>
      ) : null}
    </View>
  );
}
