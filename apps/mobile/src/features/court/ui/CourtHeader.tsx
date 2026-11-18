import { Pressable, View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import type { TeamColorName } from "../../../theme/team-colors";
import { fontFamilies } from "../../../theme/tokens.data";
import { Text } from "../../../ui/Text";
import { COLUMN_LINE_HEIGHT_EM, FLUSH } from "../court.data";
import { CloudOffIcon, MenuDotsIcon } from "./CourtIcons";
import { SetDots } from "./SetDots";

export interface CourtHeaderProps {
  readonly setNumber: number;
  /** Empty for a single set: the dots are hidden. */
  readonly sets: readonly (TeamColorName | null)[];
  readonly setsLabel: string;
  /** A plain tap on the Menu button. */
  readonly onOpenMenu: () => void;
  /** The share of the height of the screen the bar takes, in the weights of its layout. */
  readonly weight: number;
  /** The line in the middle of the bar (landscape); in the upright court it is in the strip. */
  readonly hint?: string;
}

/** The bar on top: set, sets won, "saved on the phone", and the Menu button. */
export function CourtHeader({
  setNumber,
  sets,
  setsLabel,
  onOpenMenu,
  weight,
  hint,
}: CourtHeaderProps) {
  const { colors, tokens } = useTheme();
  const { sizes, fontSizes } = tokens.court;
  return (
    <View
      style={{
        flex: weight,
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
      {hint === undefined ? null : (
        <View style={{ flex: 1, minWidth: FLUSH, alignItems: "center", justifyContent: "center" }}>
          <Text
            numberOfLines={1}
            accessibilityLiveRegion="polite"
            style={{
              color: colors.textMuted,
              fontFamily: fontFamilies.body600,
              fontSize: tokens.fontSizes.body,
              lineHeight: tokens.fontSizes.body * COLUMN_LINE_HEIGHT_EM,
            }}
          >
            {hint}
          </Text>
        </View>
      )}
      <View
        style={{
          marginLeft: hint === undefined ? "auto" : undefined,
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
        accessibilityLabel={strings.court.header.menuLabel}
        onPress={onOpenMenu}
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
    </View>
  );
}
