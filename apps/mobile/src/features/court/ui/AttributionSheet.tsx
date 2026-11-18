import type { MemberId } from "@sacou/match-engine";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { Button } from "../../../ui/Button";
import { Chip } from "../../../ui/Chip";
import { Text } from "../../../ui/Text";
import type { AttributionSheetModel, AuthorOption } from "../attribution/attribution-selectors";
import type { AuthoredPointKind } from "../attribution/attribution.reducer";

/** The sheet leaves the top of the court free, so the next point is still a tap (question 76). */
const SHEET_WIDTH = "94%";
const SHEET_MAX_HEIGHT = "66%";
/** Three players a line, as the canvas lays out the six of the rally. */
const PLAYER_BASIS = "31%";

export interface AttributionSheetProps {
  readonly model: AttributionSheetModel;
  readonly onChooseKind: (kind: AuthoredPointKind) => void;
  readonly onAuthor: (memberId: MemberId) => void;
  readonly onOpponentError: () => void;
  readonly onSkip: () => void;
}

export interface AuthorButtonProps {
  readonly option: AuthorOption;
  readonly onPress: (memberId: MemberId) => void;
}

function AuthorButton({ option, onPress }: AuthorButtonProps) {
  const { colors, tokens } = useTheme();
  const color = option.enabled ? colors.text : colors.textMuted;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={option.accessibilityLabel}
      accessibilityState={{ disabled: !option.enabled }}
      disabled={!option.enabled}
      onPress={() => {
        onPress(option.memberId);
      }}
      style={{
        flexGrow: 1,
        flexBasis: PLAYER_BASIS,
        minHeight: tokens.sizes.primaryButton,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: tokens.spacing.xs,
        borderRadius: tokens.radii.tile,
        borderWidth: tokens.court.borderWidths.outline,
        borderColor: color,
        borderStyle: option.enabled ? "solid" : "dashed",
        backgroundColor: colors.surface,
      }}
    >
      <Text variant="bodyStrong" numberOfLines={1} style={{ color }}>
        {option.badge === null ? option.name : `${option.name} · ${option.badge}`}
      </Text>
      {option.detail === null ? null : (
        <Text variant="muted" numberOfLines={1} style={{ color }}>
          {option.detail}
        </Text>
      )}
    </Pressable>
  );
}

function QuestionColumn({ model, onChooseKind, onOpponentError, onSkip }: AttributionSheetProps) {
  const { attribution } = strings.courtPlayers;
  const { colors, tokens } = useTheme();
  return (
    <View style={{ flex: 1, gap: tokens.spacing.s }}>
      <Text variant="title" accessibilityRole="header">
        {model.title}
        <Text variant="muted">{` · ${attribution.onScore}`}</Text>
      </Text>
      <Text variant="bodyStrong">
        {attribution.question}
        <Text variant="muted">{` ${attribution.questionHint}`}</Text>
      </Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={attribution.kindsLabel}
        style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.s6 }}
      >
        {model.kinds.map((option) => (
          <Chip
            key={option.kind}
            label={option.label}
            selected={option.selected}
            disabled={!option.enabled}
            onPress={() => {
              onChooseKind(option.kind);
            }}
          />
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: tokens.spacing.s }}>
        <View style={{ flex: 1 }}>
          <Button label={model.opponentError} variant="outline" onPress={onOpponentError} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label={attribution.skip} variant="secondary" onPress={onSkip} />
        </View>
      </View>
      {model.refusal === null ? null : (
        <Text accessibilityLiveRegion="polite" style={{ color: colors.refusal }}>
          {model.refusal}
        </Text>
      )}
      <Text variant="muted">{attribution.footnote}</Text>
    </View>
  );
}

/**
 * Screen 31 over the court, after a point or from "Autor" (24) and "Preencher" (25). On its side it
 * has two columns: the kinds and the error of the opponent, then the six of the rally. The court
 * behind stays live: nothing covers the top of it, and a new point asks about that one instead.
 */
export function AttributionSheet(props: AttributionSheetProps) {
  const { attribution } = strings.courtPlayers;
  const { colors, tokens } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: insets.bottom,
      }}
    >
      <View
        accessibilityViewIsModal
        accessibilityLabel={props.model.title}
        style={{
          width: SHEET_WIDTH,
          maxHeight: SHEET_MAX_HEIGHT,
          backgroundColor: colors.background,
          borderWidth: tokens.court.borderWidths.outline,
          borderColor: colors.text,
          borderTopLeftRadius: tokens.radii.sheet,
          borderTopRightRadius: tokens.radii.sheet,
        }}
      >
        <ScrollView
          contentContainerStyle={{
            flexDirection: "row",
            gap: tokens.spacing.l,
            padding: tokens.spacing.m,
          }}
        >
          <QuestionColumn {...props} />
          <View style={{ flex: 1, gap: tokens.spacing.s }}>
            <Text variant="bodyStrong">
              {props.model.teamOnCourt}
              <Text variant="muted">{` (${attribution.onCourtHint})`}</Text>
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.s6 }}>
              {props.model.players.map((option) => (
                <AuthorButton key={option.memberId} option={option} onPress={props.onAuthor} />
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
