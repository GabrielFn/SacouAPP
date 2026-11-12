import { View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { Text } from "../../../ui/Text";
import type { CustomBlock } from "../model/custom-blocks";
import { BlockFrame, BlockHeader } from "./BlockParts";

const { custom } = strings.createGroup;

export interface CustomBlockCardProps {
  readonly block: CustomBlock;
  readonly enabled: boolean;
  readonly expanded: boolean;
  readonly onToggleEnabled: (block: CustomBlock) => void;
  readonly onToggleExpanded: (block: CustomBlock) => void;
}

/** One block of screen 04a: the same card as screen 18, whose arrow opens only the text of the block. */
export function CustomBlockCard({
  block,
  enabled,
  expanded,
  onToggleEnabled,
  onToggleExpanded,
}: CustomBlockCardProps) {
  const { tokens } = useTheme();
  const text = custom.blocks[block];
  return (
    <BlockFrame title={text.title}>
      <BlockHeader
        title={text.title}
        summary={text.summary}
        expanded={expanded}
        enabled={enabled}
        editable
        onToggleExpanded={() => {
          onToggleExpanded(block);
        }}
        onEnabledChange={() => {
          onToggleEnabled(block);
        }}
      />
      {expanded ? (
        <View style={{ paddingHorizontal: tokens.spacing.s14, paddingBottom: tokens.spacing.s14 }}>
          <Text variant="caption">{text.detail}</Text>
        </View>
      ) : null}
    </BlockFrame>
  );
}
