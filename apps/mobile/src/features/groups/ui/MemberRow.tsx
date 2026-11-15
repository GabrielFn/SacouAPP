import { Pressable, View } from "react-native";

import type { Theme } from "../../../theme/themes";
import { useTheme } from "../../../theme/theme-context";
import { fontFamilies } from "../../../theme/tokens.data";
import { HeadedBlock } from "../../../ui/HeadedBlock";
import { MoreIcon, PersonIcon } from "../../../ui/Icons";
import { Text } from "../../../ui/Text";
import type { BadgeLook, MemberRowModel } from "../model/members.selectors";

import { ListRowFrame } from "./ListRowFrame";

interface BadgeColors {
  readonly background: string;
  readonly foreground: string;
  readonly border: string | null;
}

/** The role badges of Membros.dc.html: dark Admin, outlined Co-admin, blue Placar, yellow "Sem conta". */
function badgeColors(look: BadgeLook, colors: Theme): BadgeColors {
  switch (look) {
    case "admin":
      return { background: colors.text, foreground: colors.background, border: null };
    case "coAdmin":
      return { background: colors.surface, foreground: colors.text, border: colors.text };
    case "scorekeeper":
      return { background: colors.infoFill, foreground: colors.infoText, border: null };
    case "player":
      return { background: colors.badgeSurface, foreground: colors.textMuted, border: null };
    case "noAccount":
      return {
        background: colors.waitingFill,
        foreground: colors.text,
        border: colors.waitingBorder,
      };
  }
}

export interface MemberBadgeProps {
  readonly label: string;
  readonly look: BadgeLook;
}

/** Not interactive: exempt from the touch target floor. */
export function MemberBadge({ label, look }: MemberBadgeProps) {
  const { colors, tokens } = useTheme();
  const badge = badgeColors(look, colors);
  return (
    <View
      style={{
        paddingHorizontal: tokens.spacing.s,
        borderRadius: tokens.radii.field,
        backgroundColor: badge.background,
        borderWidth: badge.border === null ? undefined : tokens.borderWidths.thin,
        borderColor: badge.border ?? badge.background,
      }}
    >
      <Text
        style={{
          color: badge.foreground,
          fontFamily: fontFamilies.body700,
          fontSize: tokens.fontSizes.caption,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export interface MemberRowProps {
  readonly model: MemberRowModel;
  /** `null` when this row has no options for who looks. */
  readonly onOptions: (() => void) | null;
}

/** One row of screen 19, before the names (E3.17): a neutral avatar, the date and the role. */
export function MemberRow({ model, onOptions }: MemberRowProps) {
  const { colors, tokens } = useTheme();
  return (
    <ListRowFrame>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: tokens.sizes.avatar,
          aspectRatio: 1,
          borderRadius: tokens.radii.pill,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: model.dashedAvatar ? colors.surface : colors.avatarSurface,
          borderWidth: model.dashedAvatar ? tokens.borderWidths.thin : undefined,
          borderStyle: model.dashedAvatar ? "dashed" : undefined,
          borderColor: model.dashedAvatar ? colors.borderDashed : undefined,
        }}
      >
        <PersonIcon color={colors.textMuted} />
      </View>
      <HeadedBlock
        heading={
          <>
            <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
              {model.title}
            </Text>
            <MemberBadge label={model.badgeLabel} look={model.badgeLook} />
          </>
        }
      >
        <Text variant="muted" numberOfLines={1}>
          {model.detail}
        </Text>
      </HeadedBlock>
      {onOptions === null ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={model.optionsLabel}
          onPress={onOptions}
          style={{
            minWidth: tokens.sizes.moreButtonWidth,
            minHeight: tokens.sizes.moreButtonHeight,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MoreIcon />
        </Pressable>
      )}
    </ListRowFrame>
  );
}
