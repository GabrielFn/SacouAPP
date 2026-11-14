import { Pressable } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { fontFamilies } from "../../../theme/tokens.data";
import { PlusIcon } from "../../../ui/Icons";
import { Text } from "../../../ui/Text";

export interface CreateGroupPillProps {
  readonly onPress: () => void;
}

/** The dark "+ Criar grupo" pill of the groups list header (Grupos.dc.html). */
export function CreateGroupPill({ onPress }: CreateGroupPillProps) {
  const { colors, tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={strings.groups.createGroup}
      onPress={onPress}
      style={{
        minHeight: tokens.sizes.iconButton,
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.spacing.s6,
        paddingHorizontal: tokens.spacing.l,
        borderRadius: tokens.radii.pill,
        backgroundColor: colors.text,
      }}
    >
      <PlusIcon color={colors.background} />
      <Text style={{ color: colors.background, fontFamily: fontFamilies.body700 }}>
        {strings.groups.createGroup}
      </Text>
    </Pressable>
  );
}
