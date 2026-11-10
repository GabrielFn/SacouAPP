import { ActivityIndicator, View } from "react-native";

import { useTheme } from "../theme/theme-context";

export interface LoadingStateProps {
  readonly accessibilityLabel: string;
}

export function LoadingState({ accessibilityLabel }: LoadingStateProps) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="progressbar"
      style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
    >
      <ActivityIndicator color={colors.text} />
    </View>
  );
}
