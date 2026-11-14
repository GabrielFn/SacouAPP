import { View } from "react-native";

import { useTheme } from "../../../theme/theme-context";
import { Text } from "../../../ui/Text";

export interface StepIntroProps {
  readonly title: string;
  readonly subtitle: string;
}

/** The big title and the line under it that open the first screens of "Novo grupo". */
export function StepIntro({ title, subtitle }: StepIntroProps) {
  const { tokens } = useTheme();
  return (
    <View style={{ gap: tokens.spacing.xs }}>
      <Text variant="display" displaySize="displayTitleSmall" accessibilityRole="header">
        {title}
      </Text>
      <Text variant="muted">{subtitle}</Text>
    </View>
  );
}
