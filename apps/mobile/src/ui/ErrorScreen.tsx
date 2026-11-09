import { View } from "react-native";

import { useTheme } from "../theme/theme-context";
import { ActionButtons, type ScreenAction } from "./ActionButtons";
import { Screen } from "./Screen";
import { Text } from "./Text";

export interface ErrorScreenProps {
  readonly title: string;
  readonly body: string;
  readonly actions: readonly ScreenAction[];
}

/** A whole-screen error with a title, what it means for the user's data, and what to do next. */
export function ErrorScreen({ title, body, actions }: ErrorScreenProps) {
  const { tokens } = useTheme();
  return (
    <Screen>
      <View accessibilityRole="alert" style={{ gap: tokens.spacing.s }}>
        <Text variant="title">{title}</Text>
        <Text variant="muted">{body}</Text>
      </View>
      <ActionButtons actions={actions} />
    </Screen>
  );
}
