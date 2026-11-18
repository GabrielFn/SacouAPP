import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { ChevronRightIcon } from "../../../ui/Icons";
import { SegmentedControl } from "../../../ui/SegmentedControl";
import { Text } from "../../../ui/Text";
import { isMenuScreenReady, type EndMatchSummary } from "../model/menu-selectors";
import type { CourtThemeChoice } from "../ports/court-theme-preference";
import { CourtPage } from "./CourtPage";
import { EndMatchDialog } from "./EndMatchDialog";

export interface MatchMenuSheetProps {
  readonly subtitle: string | null;
  readonly inverted: boolean;
  readonly theme: CourtThemeChoice;
  readonly endSummary: EndMatchSummary | null;
  readonly onClose: () => void;
  readonly onCorrections: () => void;
  readonly onFlipSides: () => void;
  readonly onChooseTheme: (choice: CourtThemeChoice) => void;
  readonly onLeave: () => void;
  /** Confirmed in the dialog (or, with the set decided, the way to the end of the set). */
  readonly onEndMatch: () => void;
}

export interface MenuRowProps {
  readonly label: string;
  readonly hint?: string;
  readonly accessibilityLabel?: string;
  readonly chevron?: boolean;
  readonly onPress: () => void;
}

function MenuRow({ label, hint, accessibilityLabel, chevron = false, onPress }: MenuRowProps) {
  const { colors, tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ??
        (hint === undefined ? label : strings.court.menu.hintLabel(label, hint))
      }
      onPress={onPress}
      style={{
        minHeight: tokens.sizes.primaryButton,
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.spacing.m,
        paddingHorizontal: tokens.spacing.xs,
      }}
    >
      <Text variant="title" style={{ flexShrink: 1 }}>
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
        gap: tokens.borderWidths.thin,
      }}
    >
      {children}
    </View>
  );
}

/** Screen 23: the menu of the match, over the court. The dialog of "Encerrar partida" is its only state. */
export function MatchMenuSheet({
  subtitle,
  inverted,
  theme,
  endSummary,
  onClose,
  onCorrections,
  onFlipSides,
  onChooseTheme,
  onLeave,
  onEndMatch,
}: MatchMenuSheetProps) {
  const { menu } = strings.court;
  const { tokens } = useTheme();
  const [dialogOpen, setDialogOpen] = useState(false);
  const askToEnd = () => {
    if (endSummary?.kind === "confirm-set") {
      onEndMatch();
    } else {
      setDialogOpen(true);
    }
  };
  return (
    <CourtPage title={menu.title} subtitle={subtitle} closeLabel={menu.close} onClose={onClose}>
      <ScrollView
        contentContainerStyle={{ gap: tokens.spacing.m, paddingBottom: tokens.spacing.xl }}
      >
        <Group>
          {isMenuScreenReady("corrections") ? (
            <MenuRow
              label={menu.corrections}
              hint={menu.correctionsHint}
              chevron
              onPress={onCorrections}
            />
          ) : null}
          <MenuRow
            label={menu.flipSides}
            accessibilityLabel={menu.flipSidesLabel(inverted)}
            onPress={onFlipSides}
          />
          <View
            style={{
              minHeight: tokens.sizes.primaryButton,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: tokens.spacing.m,
              paddingHorizontal: tokens.spacing.xs,
            }}
          >
            <Text variant="title">{menu.theme}</Text>
            <View style={{ flex: 1, maxWidth: "50%" }}>
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
          <MenuRow label={menu.leave} onPress={onLeave} />
        </Group>
        {endSummary === null ? null : (
          <Group>
            <MenuRow label={menu.endMatch} chevron onPress={askToEnd} />
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
