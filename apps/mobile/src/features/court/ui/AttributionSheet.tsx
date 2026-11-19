import type { MemberId } from "@sacou/match-engine";
import { useWindowDimensions, View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { fontFamilies } from "../../../theme/tokens.data";
import { AlertCircleIcon, CheckIcon } from "../../../ui/Icons";
import { Text } from "../../../ui/Text";
import { attributionLayoutFor } from "../attribution/attribution-layout";
import type { AttributionSheetModel } from "../attribution/attribution-selectors";
import type { AuthoredPointKind } from "../attribution/attribution.reducer";
import {
  AuthorButton,
  FullButton,
  Grid,
  KIND_COLUMNS,
  KindChip,
  PLAYER_COLUMNS,
  SHEET,
} from "./AttributionControls";
import { SheetSurface } from "./SheetPanel";

export interface AttributionSheetProps {
  readonly model: AttributionSheetModel;
  readonly onChooseKind: (kind: AuthoredPointKind) => void;
  readonly onAuthor: (memberId: MemberId) => void;
  readonly onOpponentError: () => void;
  readonly onSkip: () => void;
}

export interface StatusLineProps {
  readonly title: string;
}

function StatusLine({ title }: StatusLineProps) {
  const { colors, tokens } = useTheme();
  const { onScore } = strings.courtPlayers.attribution;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s10 }}>
      <View
        style={{
          flexShrink: 1,
          minHeight: tokens.sizes.statusPill,
          flexDirection: "row",
          alignItems: "center",
          gap: tokens.spacing.s6,
          paddingHorizontal: tokens.spacing.m,
          borderRadius: tokens.radii.statusPill,
          backgroundColor: colors.goingText,
        }}
      >
        <CheckIcon color={SHEET.onInk} />
        <Text
          style={{
            flexShrink: 1,
            color: SHEET.onInk,
            fontFamily: fontFamilies.body700,
            fontSize: tokens.fontSizes.small,
          }}
        >
          {title}
        </Text>
      </View>
      <Text
        variant="caption"
        style={{ marginLeft: "auto", color: SHEET.muted, fontFamily: fontFamilies.body600 }}
      >
        {onScore}
      </Text>
    </View>
  );
}

function Question() {
  const { tokens } = useTheme();
  const { question, questionHint, afterSpace } = strings.courtPlayers.attribution;
  return (
    <Text
      variant="display"
      accessibilityRole="header"
      style={{
        color: SHEET.ink,
        fontSize: tokens.sheet.fontSizes.titleLarge,
        lineHeight: tokens.sheet.fontSizes.titleLarge,
      }}
    >
      {question}
      <Text
        style={{
          color: SHEET.muted,
          fontFamily: fontFamilies.body600,
          fontSize: tokens.fontSizes.small,
        }}
      >
        {afterSpace(questionHint)}
      </Text>
    </Text>
  );
}

function KindsBlock({ model, onChooseKind }: AttributionSheetProps) {
  const { kindsLabel } = strings.courtPlayers.attribution;
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={kindsLabel}>
      <Grid columns={KIND_COLUMNS}>
        {model.kinds.map((option) => (
          <KindChip
            key={option.kind}
            label={option.label}
            selected={option.selected}
            disabled={!option.enabled}
            onPress={() => {
              onChooseKind(option.kind);
            }}
          />
        ))}
      </Grid>
    </View>
  );
}

function PlayersBlock({ model, onAuthor }: AttributionSheetProps) {
  const { tokens } = useTheme();
  const { inParentheses, onCourtHint } = strings.courtPlayers.attribution;
  return (
    <View style={{ gap: tokens.spacing.s6 }}>
      <Text variant="caption" style={{ color: SHEET.muted, fontFamily: fontFamilies.body600 }}>
        {model.teamOnCourt}
        {inParentheses(onCourtHint)}
      </Text>
      <Grid columns={PLAYER_COLUMNS}>
        {model.players.map((option) => (
          <AuthorButton key={option.memberId} option={option} onPress={onAuthor} />
        ))}
      </Grid>
    </View>
  );
}

function OpponentErrorButton({ model, onOpponentError }: AttributionSheetProps) {
  return (
    <FullButton
      label={model.opponentError}
      filled={false}
      onPress={onOpponentError}
      icon={<AlertCircleIcon color={SHEET.ink} />}
    />
  );
}

function SkipBlock({ model, onSkip }: AttributionSheetProps) {
  const { tokens } = useTheme();
  const { skip, footnote } = strings.courtPlayers.attribution;
  return (
    <View style={{ gap: tokens.spacing.m }}>
      <FullButton label={skip} filled onPress={onSkip} />
      {model.refusal === null ? null : (
        <Text accessibilityLiveRegion="polite" style={{ color: SHEET.refusal }}>
          {model.refusal}
        </Text>
      )}
      <Text variant="caption" style={{ color: SHEET.muted, textAlign: "center" }}>
        {footnote}
      </Text>
    </View>
  );
}

/**
 * Screen 31 over the court (PontoIndividual.dc.html), after a point or from "Autor" (24) and
 * "Preencher" (25). Upright it stacks as the prototype; on its side it has two columns: the
 * question on the left, the six of the rally and the error of the opponent on the right. The scrim
 * darkens the court but lets the taps through: a new point asks about that one instead.
 */
export function AttributionSheet(props: AttributionSheetProps) {
  const { tokens } = useTheme();
  const { width, height } = useWindowDimensions();
  const columns = attributionLayoutFor(width, height) === "columns";
  const question = (
    <View style={{ gap: tokens.spacing.m }}>
      <StatusLine title={props.model.title} />
      <Question />
      <KindsBlock {...props} />
    </View>
  );
  const players = (
    <View style={{ gap: tokens.spacing.m }}>
      <PlayersBlock {...props} />
      <OpponentErrorButton {...props} />
    </View>
  );
  return (
    <SheetSurface placement="bottom" inkTopBorder accessibilityLabel={props.model.title}>
      {columns ? (
        <View style={{ flexDirection: "row", gap: tokens.spacing.xl }}>
          <View style={{ flex: 1, gap: tokens.spacing.m }}>
            {question}
            <SkipBlock {...props} />
          </View>
          <View style={{ flex: 1 }}>{players}</View>
        </View>
      ) : (
        <>
          {question}
          {players}
          <SkipBlock {...props} />
        </>
      )}
    </SheetSurface>
  );
}
