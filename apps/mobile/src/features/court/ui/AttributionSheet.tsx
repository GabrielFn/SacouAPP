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
import { sheetGap } from "./sheet-max-height";

export interface AttributionSheetProps {
  readonly model: AttributionSheetModel;
  readonly onChooseKind: (kind: AuthoredPointKind) => void;
  readonly onAuthor: (memberId: MemberId) => void;
  readonly onOpponentError: () => void;
  readonly onSkip: () => void;
  /**
   * A tap outside the sheet. Over the court (31) it is "Pular"; on screens 24 and 25 it only
   * closes, because "Pular" there goes on to the next point of the queue.
   */
  readonly onClose?: () => void;
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

function SkipBlock({ model, onSkip, gap }: AttributionSheetProps & { readonly gap: number }) {
  const { skip } = strings.courtPlayers.attribution;
  return (
    <View style={{ gap }}>
      <FullButton label={skip} filled onPress={onSkip} />
      {model.refusal === null ? null : (
        <Text accessibilityLiveRegion="polite" style={{ color: SHEET.refusal }}>
          {model.refusal}
        </Text>
      )}
    </View>
  );
}

function Footnote() {
  const { footnote } = strings.courtPlayers.attribution;
  return (
    <Text variant="caption" style={{ color: SHEET.muted, textAlign: "center" }}>
      {footnote}
    </Text>
  );
}

/**
 * Screen 31 over the court (PontoIndividual.dc.html), after a point or from "Autor" (24) and
 * "Preencher" (25). Upright it stacks as the prototype; on its side it has two columns: the
 * question on the left, the six of the rally and the error of the opponent on the right. A tap on the
 * scrim, outside the sheet, does what "Pular" does (decision of Gabriel, 19/11/2026).
 */
export function AttributionSheet(props: AttributionSheetProps) {
  const { tokens } = useTheme();
  const { width, height } = useWindowDimensions();
  const columns = attributionLayoutFor(width, height) === "columns";
  const gap = sheetGap(tokens.spacing, height);
  const question = (
    <View style={{ gap }}>
      <StatusLine title={props.model.title} />
      <Question />
      <KindsBlock {...props} />
    </View>
  );
  const players = (
    <View style={{ gap }}>
      <PlayersBlock {...props} />
      <OpponentErrorButton {...props} />
      {columns ? <Footnote /> : null}
    </View>
  );
  return (
    <SheetSurface
      placement="bottom"
      inkTopBorder
      accessibilityLabel={props.model.title}
      onDismiss={props.onClose ?? props.onSkip}
    >
      {columns ? (
        <View style={{ flexDirection: "row", gap: tokens.spacing.xl }}>
          <View style={{ flex: 1, gap }}>
            {question}
            <SkipBlock {...props} gap={gap} />
          </View>
          <View style={{ flex: 1 }}>{players}</View>
        </View>
      ) : (
        <>
          {question}
          {players}
          <SkipBlock {...props} gap={gap} />
          <Footnote />
        </>
      )}
    </SheetSurface>
  );
}
