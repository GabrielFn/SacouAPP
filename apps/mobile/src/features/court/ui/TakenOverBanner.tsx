import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { Button } from "../../../ui/Button";
import { LockIcon } from "../../../ui/Icons";
import { Text } from "../../../ui/Text";
import type { BackdropScore, TakenOverTexts } from "../takeover/takeover-texts";
import { ScoreBackdrop } from "./ScoreBackdrop";

export interface TakenOverBannerProps {
  readonly texts: TakenOverTexts;
  /** The score of the summary, or of the log of this phone without one (D7). */
  readonly backdrop: BackdropScore | null;
  readonly onLeave: () => void;
  /** `null` while the round of the session is not known: no 09a to open. */
  readonly onTakeBack: (() => void) | null;
}

/**
 * Screen 09b (PlacarAssumido.dc.html, answer 83): a `status` banner with the lock over the score, and
 * only "Sair da quadra" and "Assumir de volta": no gesture of the court exists here (D7).
 */
export function TakenOverBanner({ texts, backdrop, onLeave, onTakeBack }: TakenOverBannerProps) {
  const { colors, tokens } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScoreBackdrop score={backdrop} scrim="light">
      <View
        style={{
          flex: 1,
          justifyContent: "space-between",
          paddingTop: insets.top + tokens.spacing.xxl,
          paddingBottom: insets.bottom + tokens.spacing.xxxl,
          paddingHorizontal: tokens.spacing.m,
        }}
      >
        <View
          role="status"
          accessibilityLiveRegion="polite"
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: tokens.spacing.m,
            backgroundColor: colors.panelSurface,
            borderRadius: tokens.radii.tile,
            paddingVertical: tokens.spacing.s14,
            paddingHorizontal: tokens.spacing.l,
          }}
        >
          <LockIcon color={colors.onPanel} />
          <View style={{ flex: 1, gap: tokens.spacing.xs }}>
            <Text variant="title" style={{ color: colors.onPanel }}>
              {texts.title}
            </Text>
            <Text variant="caption" style={{ color: colors.onPanel }}>
              {texts.body}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: tokens.spacing.s }}>
          <Button label={strings.court.takenOver.leave} variant="outline" fill onPress={onLeave} />
          {onTakeBack === null ? null : (
            <Button label={strings.court.takenOver.takeBack} fill onPress={onTakeBack} />
          )}
        </View>
      </View>
    </ScoreBackdrop>
  );
}
