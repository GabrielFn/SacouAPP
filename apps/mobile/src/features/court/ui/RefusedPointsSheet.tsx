import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { Button } from "../../../ui/Button";
import { Text } from "../../../ui/Text";
import type { RefusedPointsModel, RefusedRow } from "../takeover/refused-points-model";
import type { BackdropScore, RefusedTexts } from "../takeover/takeover-texts";
import { ScoreBackdrop } from "./ScoreBackdrop";

const SHEET_MAX_HEIGHT = "85%";

export interface RefusedPointsSheetProps {
  readonly texts: RefusedTexts;
  readonly model: RefusedPointsModel;
  readonly backdrop: BackdropScore | null;
  /** "Entendi": the sheet is not shown again, the 09b comes (D6). */
  readonly onUnderstood: () => void;
}

export interface RowProps {
  readonly row: RefusedRow;
  readonly first: boolean;
}

function Row({ row, first }: RowProps) {
  const { colors, tokens } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.spacing.s10,
        minHeight: tokens.sizes.minTouchTarget,
        paddingHorizontal: tokens.spacing.s14,
        paddingVertical: tokens.spacing.s,
        borderTopWidth: first ? undefined : tokens.borderWidths.thin,
        borderTopColor: colors.borderDivider,
      }}
    >
      <Text style={{ flex: 1 }}>{row.text}</Text>
      {row.scoreText === null ? null : (
        <Text variant="display" displaySize="displayLevelBadge" tabular>
          {row.scoreText}
        </Text>
      )}
    </View>
  );
}

/**
 * Screen 09c (PontosRecusados.dc.html): the points of this phone that did not reach the stream, each
 * with its team and the score right after it. The envelopes have no time (ADR 0067, deviation g).
 */
export function RefusedPointsSheet({
  texts,
  model,
  backdrop,
  onUnderstood,
}: RefusedPointsSheetProps) {
  const { colors, tokens } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScoreBackdrop score={backdrop} scrim="dark">
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <View
          role="dialog"
          aria-modal
          accessibilityViewIsModal
          accessibilityLabel={texts.title}
          style={{
            maxHeight: SHEET_MAX_HEIGHT,
            backgroundColor: colors.background,
            borderTopLeftRadius: tokens.radii.sheet,
            borderTopRightRadius: tokens.radii.sheet,
          }}
        >
          <ScrollView
            contentContainerStyle={{
              padding: tokens.spacing.xl,
              paddingBottom: insets.bottom + tokens.spacing.xxxl,
              gap: tokens.spacing.s14,
            }}
          >
            <Text variant="display" displaySize="displayLevelCard" accessibilityRole="header">
              {texts.title}
            </Text>
            <Text variant="muted">{texts.body}</Text>
            {model.rows.length === 0 ? null : (
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: tokens.radii.tile,
                  borderWidth: tokens.borderWidths.thin,
                  borderColor: colors.borderCard,
                }}
              >
                {model.rows.map((row, index) => (
                  <Row key={row.eventId} row={row} first={index === 0} />
                ))}
              </View>
            )}
            {model.undoLeftOut ? (
              <Text variant="muted">{strings.court.refused.undoLeftOut}</Text>
            ) : null}
            <Text variant="caption">{texts.askFix}</Text>
            <Button label={strings.court.refused.understood} onPress={onUnderstood} />
          </ScrollView>
        </View>
      </View>
    </ScoreBackdrop>
  );
}
