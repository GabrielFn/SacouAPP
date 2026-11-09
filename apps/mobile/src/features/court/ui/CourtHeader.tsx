import { Pressable, View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import type { TeamColorName } from "../../../theme/team-colors";
import { fontFamilies } from "../../../theme/tokens.data";
import { Text } from "../../../ui/Text";
import { COURT_FLEX_WEIGHTS, HOLD_TO_OPEN_MENU_MS } from "../court.data";
import { CloudOffIcon, LockIcon, MenuDotsIcon } from "./CourtIcons";
import { SetDots } from "./SetDots";

export interface CourtHeaderProps {
  readonly setNumber: number;
  /** Empty for a single set: the dots are hidden. */
  readonly sets: readonly (TeamColorName | null)[];
  readonly setsLabel: string;
  /** Held on the Menu button: the menu sits behind the lock (revisao-mvp.md:40). */
  readonly onOpenMenu: () => void;
}

/** The bar on top: set, sets won, "saved on the phone", the Menu button and the lock. */
export function CourtHeader({ setNumber, sets, setsLabel, onOpenMenu }: CourtHeaderProps) {
  const { colors, tokens } = useTheme();
  const { sizes, fontSizes } = tokens.court;
  return (
    <View
      style={{
        flex: COURT_FLEX_WEIGHTS.bar,
        minHeight: sizes.menuButton,
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.spacing.s,
        paddingLeft: tokens.spacing.l,
        paddingRight: tokens.spacing.s,
        backgroundColor: colors.background,
      }}
    >
      <Text style={{ fontFamily: fontFamilies.display800, fontSize: fontSizes.setTitle }}>
        {strings.court.header.setTitle(setNumber)}
      </Text>
      {sets.length === 0 ? null : <SetDots sets={sets} accessibilityLabel={setsLabel} />}
      <View
        style={{
          marginLeft: "auto",
          flexDirection: "row",
          alignItems: "center",
          gap: tokens.court.spacing.hairGap,
        }}
      >
        <CloudOffIcon />
        <Text
          style={{
            color: colors.textMuted,
            fontFamily: fontFamilies.body600,
            fontSize: tokens.fontSizes.caption,
          }}
        >
          {strings.court.header.savedOnPhone}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={strings.court.header.menuLabelLocked}
        delayLongPress={HOLD_TO_OPEN_MENU_MS}
        onLongPress={onOpenMenu}
        style={{
          minHeight: sizes.menuButton,
          minWidth: sizes.menuButton,
          paddingHorizontal: tokens.spacing.s,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: tokens.spacing.xs,
          borderRadius: tokens.radii.field,
          borderWidth: tokens.borderWidths.thick,
          borderColor: colors.text,
        }}
      >
        <MenuDotsIcon />
        <Text
          style={{
            fontFamily: fontFamilies.body700,
            fontSize: tokens.fontSizes.caption,
          }}
        >
          {strings.court.header.menu}
        </Text>
      </Pressable>
      <View
        accessible
        accessibilityLabel={strings.court.header.lockLabelLocked}
        style={{
          minHeight: sizes.lockButton,
          minWidth: sizes.lockButton,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <LockIcon />
      </View>
    </View>
  );
}
