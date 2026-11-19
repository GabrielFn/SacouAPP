import { Children, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { lineupStrings } from "../../../strings/lineup.pt-BR";
import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { fontFamilies } from "../../../theme/tokens.data";
import { ChevronRightIcon } from "../../../ui/Icons";
import { SegmentedControl } from "../../../ui/SegmentedControl";
import { Text } from "../../../ui/Text";
import { isMenuScreenReady, type EndMatchSummary } from "../model/menu-selectors";
import type { CourtThemeChoice } from "../ports/court-theme-preference";
import { CourtPage } from "./CourtPage";
import {
  EndMatchIcon,
  FlipSidesIcon,
  LeaveCourtIcon,
  LineupIcon,
  SwapPlayersIcon,
  ThemeIcon,
  TimelineIcon,
} from "./MenuIcons";
import { EndMatchDialog } from "./EndMatchDialog";

export interface MatchMenuSheetProps {
  readonly subtitle: string | null;
  readonly inverted: boolean;
  readonly theme: CourtThemeChoice;
  readonly endSummary: EndMatchSummary | null;
  /** Someone waits on a bench: "Trocar jogador" works; otherwise it is off, "sem banco" (question 79). */
  readonly canSubstitute: boolean;
  /** Why "Encerrar partida" did nothing, in words. */
  readonly refusal?: string | null;
  readonly onClose: () => void;
  /** "Escalação" (screen 22, E4.8): absent when no team of the match rotates. */
  readonly onLineup?: (() => void) | null;
  readonly onCorrections: () => void;
  readonly onSubstitution: () => void;
  readonly onFlipSides: () => void;
  readonly onChooseTheme: (choice: CourtThemeChoice) => void;
  readonly onLeave: () => void;
  /** Confirmed in the dialog (or, with the set decided, the way to the end of the set). */
  readonly onEndMatch: () => void;
}

export interface MenuRowProps {
  readonly label: string;
  /** The icon before the label, drawn in the color it receives. */
  readonly renderIcon: (color: string) => ReactNode;
  readonly hint?: string;
  readonly accessibilityLabel?: string;
  readonly chevron?: boolean;
  readonly disabled?: boolean;
  readonly onPress: () => void;
}

function MenuRow({
  label,
  renderIcon,
  hint,
  accessibilityLabel,
  chevron = false,
  disabled = false,
  onPress,
}: MenuRowProps) {
  const { colors, tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      accessibilityLabel={
        accessibilityLabel ??
        (hint === undefined ? label : strings.court.menu.hintLabel(label, hint))
      }
      onPress={onPress}
      style={{
        minHeight: tokens.sheet.sizes.menuRow,
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.spacing.s14,
        paddingHorizontal: tokens.spacing.xs,
      }}
    >
      {renderIcon(disabled ? colors.textMuted : colors.text)}
      <Text
        variant="title"
        style={{
          flexShrink: 1,
          fontFamily: fontFamilies.body600,
          ...(disabled ? { color: colors.textMuted } : null),
        }}
      >
        {label}
        {hint === undefined ? null : (
          <Text variant="muted">{strings.court.menu.hintAfter(hint)}</Text>
        )}
      </Text>
      {chevron ? (
        <View style={{ marginLeft: "auto" }}>
          <ChevronRightIcon color={colors.textMuted} />
        </View>
      ) : null}
    </Pressable>
  );
}

export interface GroupProps {
  readonly children: ReactNode;
}

function Group({ children }: GroupProps) {
  const { colors, tokens } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.borderCard,
        borderRadius: tokens.radii.tile,
        paddingHorizontal: tokens.spacing.m,
      }}
    >
      {Children.toArray(children).map((child, index) => (
        <View
          key={index}
          style={
            index === 0
              ? null
              : { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderDivider }
          }
        >
          {child}
        </View>
      ))}
    </View>
  );
}

export interface ScreenRowsProps {
  readonly canSubstitute: boolean;
  readonly onLineup: (() => void) | null;
  readonly onSubstitution: () => void;
  readonly onCorrections: () => void;
}

/** The rows that open another screen of the court, each only once its screen exists. */
function ScreenRows({ canSubstitute, onLineup, onSubstitution, onCorrections }: ScreenRowsProps) {
  const { menu } = strings.court;
  const { courtPlayers } = strings;
  return (
    <>
      {isMenuScreenReady("lineup") && onLineup !== null ? (
        <MenuRow
          label={lineupStrings.menuItem}
          renderIcon={(color) => <LineupIcon color={color} />}
          chevron
          onPress={onLineup}
        />
      ) : null}
      {isMenuScreenReady("substitution") ? (
        <MenuRow
          label={courtPlayers.substitution.menuItem}
          renderIcon={(color) => <SwapPlayersIcon color={color} />}
          {...(canSubstitute ? {} : { hint: courtPlayers.substitution.noBench })}
          chevron={canSubstitute}
          disabled={!canSubstitute}
          onPress={onSubstitution}
        />
      ) : null}
      {isMenuScreenReady("corrections") ? (
        <MenuRow
          label={menu.corrections}
          renderIcon={(color) => <TimelineIcon color={color} />}
          hint={menu.correctionsHint}
          chevron
          onPress={onCorrections}
        />
      ) : null}
    </>
  );
}

/** Screen 23: the menu of the match, over the court. The dialog of "Encerrar partida" is its only state. */
export function MatchMenuSheet({
  subtitle,
  inverted,
  theme,
  endSummary,
  canSubstitute,
  refusal = null,
  onClose,
  onLineup = null,
  onCorrections,
  onSubstitution,
  onFlipSides,
  onChooseTheme,
  onLeave,
  onEndMatch,
}: MatchMenuSheetProps) {
  const { menu } = strings.court;
  const { colors, tokens } = useTheme();
  const [dialogOpen, setDialogOpen] = useState(false);
  const askToEnd = () => {
    if (endSummary?.kind === "confirm-set") {
      onEndMatch();
    } else {
      setDialogOpen(true);
    }
  };
  return (
    <CourtPage
      sheet
      titleSize="menu"
      title={menu.title}
      subtitle={subtitle}
      closeLabel={menu.close}
      onClose={onClose}
    >
      <ScrollView
        contentContainerStyle={{ gap: tokens.spacing.m, paddingBottom: tokens.spacing.xl }}
      >
        <Group>
          <ScreenRows
            canSubstitute={canSubstitute}
            onLineup={onLineup}
            onSubstitution={onSubstitution}
            onCorrections={onCorrections}
          />
          <MenuRow
            label={menu.flipSides}
            renderIcon={(color) => <FlipSidesIcon color={color} />}
            accessibilityLabel={menu.flipSidesLabel(inverted)}
            onPress={onFlipSides}
          />
          <View
            style={{
              minHeight: tokens.sheet.sizes.menuRow,
              flexDirection: "row",
              alignItems: "center",
              gap: tokens.spacing.s14,
              paddingHorizontal: tokens.spacing.xs,
            }}
          >
            <ThemeIcon color={colors.text} />
            <Text variant="title" style={{ fontFamily: fontFamilies.body600 }}>
              {menu.theme}
            </Text>
            <View style={{ flex: 1, maxWidth: "50%", marginLeft: "auto" }}>
              <SegmentedControl
                accessibilityLabel={menu.themeLabel}
                selected={theme}
                onSelect={onChooseTheme}
                options={[
                  { value: "sun", label: menu.themeSun },
                  { value: "night", label: menu.themeNight },
                ]}
              />
            </View>
          </View>
          <MenuRow
            label={menu.leave}
            renderIcon={(color) => <LeaveCourtIcon color={color} />}
            onPress={onLeave}
          />
        </Group>
        {refusal === null ? null : (
          <Text accessibilityLiveRegion="polite" style={{ color: colors.refusal }}>
            {refusal}
          </Text>
        )}
        {endSummary === null ? null : (
          <Group>
            <MenuRow
              label={menu.endMatch}
              renderIcon={(color) => <EndMatchIcon color={color} />}
              chevron
              onPress={askToEnd}
            />
          </Group>
        )}
      </ScrollView>
      {endSummary === null || endSummary.kind === "confirm-set" ? null : (
        <EndMatchDialog
          visible={dialogOpen}
          summary={endSummary}
          onConfirm={() => {
            setDialogOpen(false);
            onEndMatch();
          }}
          onCancel={() => {
            setDialogOpen(false);
          }}
        />
      )}
    </CourtPage>
  );
}
