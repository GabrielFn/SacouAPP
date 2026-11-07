import type { ReactNode } from "react";
import { View } from "react-native";

import { strings } from "../strings/pt-BR";
import { useTheme } from "../theme/theme-context";

import { Logo } from "./Icons";
import { Text } from "./Text";

export interface AppHeaderProps {
  readonly action?: ReactNode;
}

export function AppHeader({ action }: AppHeaderProps) {
  const { tokens } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s }}
        accessibilityLabel={strings.a11y.logo}
      >
        <Logo size={tokens.sizes.logo} />
        <Text variant="display" displaySize="displayBrand">
          {strings.appName}
        </Text>
      </View>
      {action}
    </View>
  );
}
