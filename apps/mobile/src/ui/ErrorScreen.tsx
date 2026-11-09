import { View } from "react-native";

import { useTheme } from "../theme/theme-context";
import { Button, type ButtonVariant } from "./Button";
import { Screen } from "./Screen";
import { Text } from "./Text";

export interface ErrorAction {
  readonly label: string;
  readonly variant?: ButtonVariant;
  readonly onPress: () => void;
}

export interface ErrorScreenProps {
  readonly title: string;
  readonly body: string;
  readonly actions: readonly ErrorAction[];
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
      {actions.map(({ label, variant, onPress }) => (
        <Button key={label} label={label} variant={variant} onPress={onPress} />
      ))}
    </Screen>
  );
}
