import { Pressable, View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { fontFamilies } from "../../../theme/tokens.data";
import { Text } from "../../../ui/Text";
import type { ActiveCourt } from "../session/active-court";

const { activeBar: texts } = strings.court;

export interface ActiveCourtBarProps {
  readonly court: ActiveCourt;
  /** The name of the group of the session, from the cache; `null` when unknown (or a sample). */
  readonly groupName: string | null;
  readonly onOpen: (courtSessionId: string) => void;
}

/**
 * "EM QUADRA · Racha de terça · Laranja 18 x 15 Azul · Abrir quadra" (Inicio.dc.html:88-95, R97 D1):
 * the whole bar is one link to the court of the match open on this phone. Only the group name and
 * the score, both already on the phone.
 */
export function ActiveCourtBar({ court, groupName, onOpen }: ActiveCourtBarProps) {
  const { colors, tokens } = useTheme();
  const { a, b } = court.score;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={texts.accessibilityLabel(groupName, a, b)}
      onPress={() => {
        onOpen(court.courtSessionId);
      }}
      style={{
        minHeight: tokens.sizes.activeBarMin,
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.spacing.m,
        paddingLeft: tokens.spacing.l,
        paddingRight: tokens.spacing.s,
        paddingVertical: tokens.spacing.s,
        borderRadius: tokens.radii.tile,
        backgroundColor: colors.panelSurface,
      }}
    >
      <View
        style={{
          width: tokens.sizes.liveDot,
          aspectRatio: 1,
          borderRadius: tokens.sizes.liveDot,
          backgroundColor: colors.primary,
        }}
      />
      <View style={{ flex: 1 }}>
        <Text
          variant="caption"
          numberOfLines={1}
          style={{ color: colors.panelAccent, fontFamily: fontFamilies.body700 }}
        >
          {texts.label(groupName)}
        </Text>
        <Text variant="display" tabular numberOfLines={1} style={{ color: colors.onPanel }}>
          {texts.score(a, b)}
        </Text>
      </View>
      <View
        style={{
          minHeight: tokens.sizes.iconButton,
          justifyContent: "center",
          paddingHorizontal: tokens.spacing.s14,
          borderRadius: tokens.radii.field,
          backgroundColor: colors.primary,
        }}
      >
        <Text variant="bodyStrong" style={{ color: colors.onPrimary, fontFamily: fontFamilies.body700 }}>
          {texts.open}
        </Text>
      </View>
    </Pressable>
  );
}
