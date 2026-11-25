import { useState } from "react";
import { View } from "react-native";

import type { ErrorReporter } from "../../../services/error-reporting/error-reporter";
import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { Button } from "../../../ui/Button";
import { Text } from "../../../ui/Text";

/** The error of the acceptance test (E5.2, D12): a fixed English message, no personal data. */
export class DeliberateFailure extends Error {
  constructor() {
    super("Deliberate failure from the development screen (E5.2).");
    this.name = "DeliberateFailure";
  }
}

export const ERROR_TEST_AREA = "dev-catalog";

export interface ErrorTestSectionProps {
  readonly errorReporter: ErrorReporter;
}

/** Development screen only (EXPO_PUBLIC_DEV_TOOLS): proves that JS and native errors reach Sentry. */
export function ErrorTestSection({ errorReporter }: ErrorTestSectionProps) {
  const { colors, tokens } = useTheme();
  const [sent, setSent] = useState(false);
  const texts = strings.catalog.errorTest;
  return (
    <View
      style={{
        backgroundColor: colors.background,
        padding: tokens.spacing.xl,
        gap: tokens.spacing.m,
      }}
    >
      <Text variant="title">{texts.title}</Text>
      <Button
        label={texts.sendError}
        onPress={() => {
          errorReporter.captureError(new DeliberateFailure(), { area: ERROR_TEST_AREA });
          setSent(true);
        }}
      />
      <Button
        label={texts.crashApp}
        variant="danger"
        onPress={() => {
          errorReporter.crashNatively();
        }}
      />
      {sent ? <Text variant="muted">{texts.sent}</Text> : null}
    </View>
  );
}
