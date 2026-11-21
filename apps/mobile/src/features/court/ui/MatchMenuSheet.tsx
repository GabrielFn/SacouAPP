import { Children, useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { fontFamilies } from "../../../theme/tokens.data";
import { SegmentedControl } from "../../../ui/SegmentedControl";
import { Text } from "../../../ui/Text";
import type { EndRoundView } from "../end-round/end-round-view";
import type { EndMatchSummary } from "../model/menu-selectors";
import type { CourtThemeChoice } from "../ports/court-theme-preference";
import { CourtPage } from "./CourtPage";
import { EndMatchIcon, EndRoundIcon, FlipSidesIcon, LeaveCourtIcon, ThemeIcon } from "./MenuIcons";
import { EndMatchDialog } from "./EndMatchDialog";
import { EndRoundDialog } from "./EndRoundDialog";
import { MenuRow } from "./MenuRow";
import { screenRows } from "./MenuScreenRows";

/** "Encerrar rodada · fecha a noite toda" and its dialog: absent for a session without a round. */
export interface EndRoundMenuControl {
  readonly view: EndRoundView;
  readonly onAsk: () => void;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

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
  readonly endRound?: EndRoundMenuControl | null;
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

export interface EndGroupProps {
  readonly hasEndMatch: boolean;
  readonly endRound: EndRoundMenuControl | null;
  readonly onEndMatch: () => void;
}

/** "Encerrar partida" and "Encerrar rodada · fecha a noite toda", the last group of the menu. */
function EndGroup({ hasEndMatch, endRound, onEndMatch }: EndGroupProps) {
  const { menu } = strings.court;
  const { colors } = useTheme();
  if (!hasEndMatch && endRound === null) return null;
  return (
    <>
      {endRound?.view.failure == null ? null : (
        <Text accessibilityLiveRegion="polite" style={{ color: colors.refusal }}>
          {endRound.view.failure}
        </Text>
      )}
      <Group>
        {hasEndMatch ? (
          <MenuRow
            label={menu.endMatch}
            renderIcon={(color) => <EndMatchIcon color={color} />}
            chevron
            onPress={onEndMatch}
          />
        ) : null}
        {endRound === null ? null : (
          <MenuRow
            label={menu.endRound}
            hint={menu.endRoundHint}
            danger
            disabled={endRound.view.busy}
            renderIcon={(color) => <EndRoundIcon color={color} />}
            onPress={endRound.onAsk}
          />
        )}
      </Group>
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
  endRound = null,
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
          {screenRows({ canSubstitute, onLineup, onSubstitution, onCorrections })}
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
            note={menu.leaveNote}
            renderIcon={(color) => <LeaveCourtIcon color={color} />}
            onPress={onLeave}
          />
        </Group>
        {refusal === null ? null : (
          <Text accessibilityLiveRegion="polite" style={{ color: colors.refusal }}>
            {refusal}
          </Text>
        )}
        <EndGroup hasEndMatch={endSummary !== null} endRound={endRound} onEndMatch={askToEnd} />
      </ScrollView>
      {endRound === null ? null : (
        <EndRoundDialog
          score={endRound.view.confirmingScore}
          onConfirm={endRound.onConfirm}
          onCancel={endRound.onCancel}
        />
      )}
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
