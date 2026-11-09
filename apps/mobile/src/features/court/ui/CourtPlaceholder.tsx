import { View } from "react-native";

import { useTheme } from "../../../theme/theme-context";
import { Button, type ButtonVariant } from "../../../ui/Button";
import { Screen } from "../../../ui/Screen";
import { Text } from "../../../ui/Text";

export interface PlaceholderAction {
  readonly label: string;
  readonly variant?: ButtonVariant;
  readonly onPress: () => void;
}

export interface CourtPlaceholderProps {
  readonly title: string;
  readonly lines: readonly string[];
  readonly actions: readonly PlaceholderAction[];
}

/** A plain page for the routes that E4.10 designs (end of set and match, menu, corrections). */
export function CourtPlaceholder({ title, lines, actions }: CourtPlaceholderProps) {
  const { tokens } = useTheme();
  return (
    <Screen>
      <Text variant="display" displaySize="displayTitleSmall" accessibilityRole="header">
        {title}
      </Text>
      <View style={{ gap: tokens.spacing.s }}>
        {lines.map((line) => (
          <Text key={line}>{line}</Text>
        ))}
      </View>
      {actions.map(({ label, variant, onPress }) => (
        <Button key={label} label={label} variant={variant} onPress={onPress} />
      ))}
    </Screen>
  );
}
