import { View } from "react-native";

import { useTheme } from "../../../theme/theme-context";
import { ActionButtons, type ScreenAction } from "../../../ui/ActionButtons";
import { Screen } from "../../../ui/Screen";
import { Text } from "../../../ui/Text";

export interface CourtPlaceholderProps {
  readonly title: string;
  readonly lines: readonly string[];
  readonly actions: readonly ScreenAction[];
}

/** A plain page for the routes that E4.10 designs (end of set and match, menu, corrections). */
export function CourtPlaceholder({ title, lines, actions }: CourtPlaceholderProps) {
  const { tokens } = useTheme();
  return (
    <Screen scroll maxContentWidth={tokens.court.sizes.sheetMaxWidth}>
      <Text variant="display" displaySize="displayTitleSmall" accessibilityRole="header">
        {title}
      </Text>
      <View style={{ gap: tokens.spacing.s }}>
        {lines.map((line) => (
          <Text key={line}>{line}</Text>
        ))}
      </View>
      <ActionButtons actions={actions} />
    </Screen>
  );
}
