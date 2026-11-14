import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { ChevronDownIcon } from "../../../ui/Icons";
import { Switch } from "../../../ui/Switch";
import { Text } from "../../../ui/Text";

const { screen } = strings.settings;

export interface BlockFrameProps {
  readonly title: string;
  readonly children: ReactNode;
}

/** The card of a block, shared by screen 18 and screen 04a. */
export function BlockFrame({ title, children }: BlockFrameProps) {
  const { colors, tokens } = useTheme();
  return (
    <View
      accessibilityLabel={title}
      style={{
        backgroundColor: colors.surface,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.borderCard,
        borderRadius: tokens.radii.tile,
        overflow: "hidden",
      }}
    >
      {children}
    </View>
  );
}

export interface BlockHeaderProps {
  readonly title: string;
  readonly caption?: string;
  /** The line under the title of an accordion; `null` for a block that is always open. */
  readonly summary: string | null;
  readonly expanded: boolean;
  readonly enabled: boolean;
  readonly editable: boolean;
  readonly onToggleExpanded: () => void;
  readonly onEnabledChange: (enabled: boolean) => void;
}

/** The head of a block: title (and summary with a chevron, for an accordion) and the block switch. */
export function BlockHeader({
  title,
  caption,
  summary,
  expanded,
  enabled,
  editable,
  onToggleExpanded,
  onEnabledChange,
}: BlockHeaderProps) {
  const { tokens } = useTheme();
  return (
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
      {summary === null ? (
        <View
          style={{ flex: 1, flexDirection: "row", alignItems: "baseline", gap: tokens.spacing.s }}
        >
          <Text variant="title" accessibilityRole="header">
            {title}
          </Text>
          {caption === undefined ? null : <Text variant="caption">{caption}</Text>}
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={expanded ? screen.collapse(title) : screen.expand(title)}
          onPress={onToggleExpanded}
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
            <Text variant="title">{title}</Text>
            <Text variant="caption">{summary}</Text>
          </View>
          <ChevronDownIcon />
        </Pressable>
      )}
      <Switch
        accessibilityLabel={title}
        checked={enabled}
        disabled={!editable}
        onChange={onEnabledChange}
      />
    </View>
  );
}
