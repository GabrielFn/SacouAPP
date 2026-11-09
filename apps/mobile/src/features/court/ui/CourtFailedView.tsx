import { View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { Button } from "../../../ui/Button";
import { Screen } from "../../../ui/Screen";
import { Text } from "../../../ui/Text";

export interface CourtFailedViewProps {
  readonly onRetry: () => void;
  readonly onLeave: () => void;
}

/** "Não conseguimos abrir esta partida": nothing is erased, the match stays in the file. */
export function CourtFailedView({ onRetry, onLeave }: CourtFailedViewProps) {
  const { tokens } = useTheme();
  return (
    <Screen>
      <View accessibilityRole="alert" style={{ gap: tokens.spacing.s }}>
        <Text variant="title">{strings.court.error.title}</Text>
        <Text variant="muted">{strings.court.error.body}</Text>
      </View>
      <Button label={strings.court.error.retry} onPress={onRetry} />
      <Button label={strings.court.error.back} variant="secondary" onPress={onLeave} />
    </Screen>
  );
}
