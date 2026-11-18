import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { Button } from "../../../ui/Button";
import { Text } from "../../../ui/Text";
import type { BackdropScore, TakeoverCardTexts } from "../takeover/takeover-texts";
import type { TakeOverAction } from "../takeover/takeover-view";
import { ScoreBackdrop } from "./ScoreBackdrop";

export interface TakeOverDialogProps {
  /** `null` until the summary arrives (or when it failed): the card says only the line below. */
  readonly card: TakeoverCardTexts | null;
  readonly backdrop: BackdropScore | null;
  /** "O placar mudou...", a failure, or `null`. */
  readonly notice: string | null;
  readonly action: TakeOverAction;
  readonly onConfirm: () => void;
  readonly onRetry: () => void;
  readonly onBack: () => void;
}

const { takeover } = strings.court;

export interface ActionButtonProps {
  readonly action: TakeOverAction;
  readonly onConfirm: () => void;
  readonly onRetry: () => void;
}

function ActionButton({ action, onConfirm, onRetry }: ActionButtonProps) {
  switch (action.kind) {
    case "none":
      return null;
    case "reading":
      return <Button label={takeover.reading} busy onPress={onConfirm} />;
    case "busy":
      return <Button label={action.label} busy onPress={onConfirm} />;
    case "confirm":
      return <Button label={takeover.confirm} onPress={onConfirm} />;
    case "retry":
      return <Button label={takeover.retry} onPress={onRetry} />;
  }
}

export interface ScoreCardProps {
  readonly card: TakeoverCardTexts;
}

function ScoreCard({ card }: ScoreCardProps) {
  const { colors, tokens } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.borderCard,
        borderRadius: tokens.radii.tile,
        paddingVertical: tokens.spacing.m,
        paddingHorizontal: tokens.spacing.s14,
        gap: tokens.spacing.xs,
      }}
    >
      <Text variant="caption">{card.lastPoint}</Text>
      <Text variant="display" displaySize="displayLevelCard">
        {card.score}
      </Text>
      <Text variant="caption">{takeover.check}</Text>
    </View>
  );
}

/**
 * Screen 09a (AssumirQuadra.dc.html) without "Só olhar" (answer 75): who marks, the last point and the
 * score, "Assumir o placar" and "Voltar", which closes it (answer 82). An `alertdialog` over the score.
 */
export function TakeOverDialog({
  card,
  backdrop,
  notice,
  action,
  onConfirm,
  onRetry,
  onBack,
}: TakeOverDialogProps) {
  const { colors, tokens } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScoreBackdrop score={backdrop} scrim="dark">
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          paddingHorizontal: tokens.spacing.xl,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        <View
          role="alertdialog"
          aria-modal
          accessibilityViewIsModal
          accessibilityLabel={takeover.title}
          style={{
            backgroundColor: colors.background,
            borderRadius: tokens.radii.pill,
            padding: tokens.spacing.xl,
            gap: tokens.spacing.s14,
          }}
        >
          <Text variant="display" displaySize="displayLevelCard" accessibilityRole="header">
            {takeover.title}
          </Text>
          {card === null ? null : (
            <>
              <Text variant="muted" style={{ fontSize: tokens.fontSizes.body }}>
                {card.body}
              </Text>
              <ScoreCard card={card} />
            </>
          )}
          {notice === null ? null : (
            <Text accessibilityRole="alert" style={{ color: colors.refusal }}>
              {notice}
            </Text>
          )}
          <ActionButton action={action} onConfirm={onConfirm} onRetry={onRetry} />
          <Button label={takeover.back} variant="outline" onPress={onBack} />
        </View>
      </View>
    </ScoreBackdrop>
  );
}
