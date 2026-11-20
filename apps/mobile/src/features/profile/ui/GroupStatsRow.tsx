import { View } from "react-native";

import { fontFamilies } from "../../../theme/tokens.data";
import { useTheme } from "../../../theme/theme-context";
import { Text } from "../../../ui/Text";
import type { GroupStatsRowModel } from "../model/group-stats";

export interface GroupStatsRowProps {
  readonly row: GroupStatsRowModel;
  /** The last row has no line under it. */
  readonly last: boolean;
}

/** A group of "Por grupo": its name on one line, the numbers under it, and the modality as a chip. */
export function GroupStatsRow({ row, last }: GroupStatsRowProps) {
  const { colors, tokens } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={[row.name, row.summary, row.modalityLabel].filter(Boolean).join(", ")}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.spacing.s10,
        paddingVertical: tokens.spacing.s10,
        paddingHorizontal: tokens.spacing.m,
        borderBottomWidth: last ? undefined : tokens.borderWidths.thin,
        borderBottomColor: colors.borderDivider,
      }}
    >
      <View style={{ flex: 1, gap: tokens.spacing.xs }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {row.name}
        </Text>
        <Text variant="caption" tabular>
          {row.summary}
        </Text>
      </View>
      {row.modalityLabel === null ? null : (
        <View
          style={{
            minHeight: tokens.sizes.roleBadge,
            paddingHorizontal: tokens.spacing.s,
            borderRadius: tokens.radii.roleBadge,
            backgroundColor: colors.badgeSurface,
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              color: colors.textMuted,
              fontFamily: fontFamilies.body600,
              fontSize: tokens.fontSizes.legal,
            }}
          >
            {row.modalityLabel}
          </Text>
        </View>
      )}
    </View>
  );
}
