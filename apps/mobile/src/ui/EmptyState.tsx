import { View } from "react-native";

import { useTheme } from "../theme/theme-context";
import { ActionButtons, type ScreenAction } from "./ActionButtons";
import { Text } from "./Text";

export interface EmptyStateProps {
  readonly title: string;
  readonly body: string;
  readonly actions?: readonly ScreenAction[];
  /** The screen reader announces the text at once (an error), not only when it is reached. */
  readonly alert?: boolean;
}

/** A page with nothing to show or something wrong: what it is, what it means, and what to do. */
export function EmptyState({ title, body, actions = [], alert = false }: EmptyStateProps) {
  const { tokens } = useTheme();
  return (
    <View style={{ gap: tokens.spacing.l }}>
      <View accessibilityRole={alert ? "alert" : undefined} style={{ gap: tokens.spacing.s }}>
        <Text variant="title">{title}</Text>
        <Text variant="muted">{body}</Text>
      </View>
      <ActionButtons actions={actions} />
    </View>
  );
}
