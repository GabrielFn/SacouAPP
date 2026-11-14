import { Pressable, View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { fontFamilies } from "../../../theme/tokens.data";
import { LinkIcon } from "../../../ui/Icons";
import { Text } from "../../../ui/Text";
import type { InviteRowModel } from "../model/members.selectors";

export interface InviteRowProps {
  readonly model: InviteRowModel;
  readonly disabled: boolean;
  readonly onRevoke: () => void;
}

/** A valid invite on the "Convites" tab: when it was made, how many came in, and "Revogar". */
export function InviteRow({ model, disabled, onRevoke }: InviteRowProps) {
  const { colors, tokens } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.spacing.s10,
        minHeight: tokens.sizes.memberRowMin,
        paddingLeft: tokens.spacing.m,
      }}
    >
      <LinkIcon color={colors.textMuted} />
      <Text style={{ flex: 1 }}>{model.text}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={model.revokeLabel}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onRevoke}
        style={{
          minHeight: tokens.sizes.minTouchTarget,
          paddingHorizontal: tokens.spacing.m,
          justifyContent: "center",
        }}
      >
        <Text style={{ color: colors.danger, fontFamily: fontFamilies.body700 }}>
          {strings.members.invites.revoke}
        </Text>
      </Pressable>
    </View>
  );
}
