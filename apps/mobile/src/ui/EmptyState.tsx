import { View } from "react-native";

import { useTheme } from "../theme/theme-context";
import { ActionButtons, type ScreenAction } from "./ActionButtons";
import { Text } from "./Text";

export interface EmptyStateProps {
  readonly title: string;
  readonly body: string;
  readonly actions?: readonly ScreenAction[];
}

/** A list with nothing to show: what is missing, why, and what to do about it. */
export function EmptyState({ title, body, actions = [] }: EmptyStateProps) {
  const { tokens } = useTheme();
  return (
    <View style={{ gap: tokens.spacing.l }}>
      <View style={{ gap: tokens.spacing.s }}>
        <Text variant="title">{title}</Text>
        <Text variant="muted">{body}</Text>
      </View>
      <ActionButtons actions={actions} />
    </View>
  );
}
