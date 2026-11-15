import { View } from "react-native";

import { errorTextOf } from "../../../services/api/api-error-text";
import type { Round } from "../../../services/api/sacou-api";
import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { EmptyState } from "../../../ui/EmptyState";
import { LoadingState } from "../../../ui/LoadingState";
import { Text } from "../../../ui/Text";
import { roundSubtitle } from "../model/round-detail";

const { detail } = strings.rounds;

export interface RoundHeadingProps {
  readonly groupName: string;
  readonly round: Round;
}

/** The name of the group and "Ter 3/11 · 20h30 · Ginásio Sesc", the same on screens 06 and 26. */
export function RoundHeading({ groupName, round }: RoundHeadingProps) {
  const { tokens } = useTheme();
  return (
    <View style={{ gap: tokens.spacing.xs }}>
      <Text variant="display" displaySize="displayMedium" accessibilityRole="header">
        {groupName}
      </Text>
      <Text variant="muted">{roundSubtitle(round)}</Text>
    </View>
  );
}

export interface RoundLoadingProps {
  readonly failure: Error | null;
  readonly onRetry: () => void;
}

/** The wait for the round, or the reason it could not be read. */
export function RoundLoading({ failure, onRetry }: RoundLoadingProps) {
  if (failure === null) return <LoadingState accessibilityLabel={detail.loading} />;
  return (
    <EmptyState
      alert
      title={detail.loadError}
      body={errorTextOf(failure)}
      actions={[{ label: detail.retry, variant: "secondary", onPress: onRetry }]}
    />
  );
}
