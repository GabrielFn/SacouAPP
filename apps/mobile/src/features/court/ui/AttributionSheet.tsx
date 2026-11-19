import type { MemberId } from "@sacou/match-engine";
import type { ReactNode } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { courtPalette, fontFamilies, palette } from "../../../theme/tokens.data";
import { AlertCircleIcon, CheckIcon } from "../../../ui/Icons";
import { Text } from "../../../ui/Text";
import { attributionLayoutFor } from "../attribution/attribution-layout";
import type { AttributionSheetModel, AuthorOption } from "../attribution/attribution-selectors";
import type { AuthoredPointKind } from "../attribution/attribution.reducer";
import { SheetSurface } from "./SheetPanel";

/** The sheet is always the light one of the prototype (PontoIndividual.dc.html), in both themes. */
const SHEET = {
  ground: palette.sand,
  ink: palette.black,
  muted: courtPalette.sun.muted,
  refusal: courtPalette.sun.refusal,
  onInk: palette.white,
} as const;
/** Three players a line, four kinds a line, as the canvas lays them out. */
const PLAYER_COLUMNS = 3;
const KIND_COLUMNS = 4;

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
  const { tokens } = useTheme();
  const color = option.enabled ? SHEET.ink : SHEET.muted;
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
        height: tokens.sizes.playerCard,
        alignItems: "center",
        justifyContent: "center",
        gap: tokens.spacing.xs / 2,
        paddingHorizontal: tokens.spacing.xs,
        borderRadius: tokens.radii.field,
        borderWidth: tokens.borderWidths.thick,
        borderColor: color,
        borderStyle: option.enabled ? "solid" : "dashed",
        backgroundColor: palette.white,
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          color,
          fontFamily: fontFamilies.body700,
          fontSize: tokens.fontSizes.button,
        }}
      >
        {option.name}
      </Text>
      {option.detail === null ? null : (
        <Text variant="caption" numberOfLines={1} style={{ color: SHEET.muted }}>
          {option.detail}
        </Text>
      )}
      {option.badge === null ? null : (
        <View
          style={{
            position: "absolute",
            top: tokens.spacing.s6,
            right: tokens.spacing.s6,
            minWidth: tokens.sizes.authorBadge,
            height: tokens.sizes.authorBadge,
            borderRadius: tokens.sizes.authorBadge,
            paddingHorizontal: tokens.spacing.xs,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: SHEET.ink,
          }}
        >
          <Text
            style={{
              color: SHEET.onInk,
              fontFamily: fontFamilies.body700,
              fontSize: tokens.fontSizes.authorBadge,
            }}
          >
            {option.badge}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

interface KindChipProps {
  readonly label: string;
  readonly selected: boolean;
  readonly disabled: boolean;
  readonly onPress: () => void;
}

function KindChip({ label, selected, disabled, onPress }: KindChipProps) {
  const { tokens } = useTheme();
  const color = disabled ? SHEET.muted : SHEET.ink;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        height: tokens.sizes.chip,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: tokens.radii.pill,
        borderWidth: tokens.borderWidths.thick,
        borderColor: color,
        borderStyle: disabled ? "dashed" : "solid",
        backgroundColor: selected ? SHEET.ink : palette.white,
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          color: selected ? SHEET.onInk : color,
          fontFamily: fontFamilies.body700,
          fontSize: tokens.fontSizes.body,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Rows of equal columns: a short last row keeps the width of its cells. */
function Grid({ columns, children }: { readonly columns: number; readonly children: ReactNode[] }) {
  const { tokens } = useTheme();
  const rows = Array.from({ length: Math.ceil(children.length / columns) }, (_, row) =>
    Array.from({ length: columns }, (_cell, column) => children[row * columns + column] ?? null),
  );
  return (
    <View style={{ gap: tokens.spacing.s }}>
      {rows.map((cells, row) => (
        <View key={row} style={{ flexDirection: "row", gap: tokens.spacing.s }}>
          {cells.map((cell, column) => (
            <View key={column} style={{ flex: 1 }}>
              {cell}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function StatusLine({ title }: { readonly title: string }) {
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
        fontSize: tokens.fontSizes.sheetTitleLarge,
        lineHeight: tokens.fontSizes.sheetTitleLarge,
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

interface FullButtonProps {
  readonly label: string;
  readonly filled: boolean;
  readonly onPress: () => void;
  readonly icon?: ReactNode;
}

/** The two 56 high buttons of the sheet: "Pular" black, "Erro do <time>" dashed. */
function FullButton({ label, filled, onPress, icon }: FullButtonProps) {
  const { tokens } = useTheme();
  const color = filled ? SHEET.onInk : SHEET.ink;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        height: tokens.sizes.primaryButton,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: tokens.spacing.s,
        borderRadius: tokens.radii.button,
        borderWidth: filled ? 0 : tokens.borderWidths.thick,
        borderStyle: "dashed",
        borderColor: SHEET.ink,
        backgroundColor: filled ? SHEET.ink : "transparent",
      }}
    >
      {icon}
      <Text style={{ color, fontFamily: fontFamilies.body700, fontSize: tokens.fontSizes.button }}>
        {label}
      </Text>
    </Pressable>
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
