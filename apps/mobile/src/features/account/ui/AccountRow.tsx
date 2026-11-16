import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { useTheme } from "../../../theme/theme-context";
import { ChevronRightIcon } from "../../../ui/Icons";
import { Text } from "../../../ui/Text";

/** The key column of "Seus dados": 72 of the 358 of the card in the canvas (Conta.dc.html `.k`). */
const KEY_BASIS = "20%";

export interface AccountCardProps {
  readonly title: string;
  readonly children: ReactNode;
}

/** A titled white card of rows (Conta.dc.html `.gh` and `.cd`). */
export function AccountCard({ title, children }: AccountCardProps) {
  const { colors, tokens } = useTheme();
  return (
    <View style={{ gap: tokens.spacing.s6 }}>
      <Text variant="muted" style={{ fontSize: tokens.fontSizes.small }} accessibilityRole="header">
        {title}
      </Text>
      <View
        style={{
          backgroundColor: colors.surface,
          borderWidth: tokens.borderWidths.thin,
          borderColor: colors.borderCard,
          borderRadius: tokens.radii.tile,
          overflow: "hidden",
        }}
      >
        {children}
      </View>
    </View>
  );
}

export interface AccountRowProps {
  /** The grey key of "Seus dados" ("E-mail"), before the value. */
  readonly keyLabel?: string;
  /** The value or the label of the row, in bold. */
  readonly label: string;
  /** The grey note before the arrow ("Lista, espera, times"). */
  readonly note?: string;
  readonly icon?: ReactNode;
  /** Drawn between the key and the value (the "G" of the login). */
  readonly valueIcon?: ReactNode;
  /** Without it the row is read only (the e-mail and the login come from the phone). */
  readonly onPress?: () => void;
  readonly accessibilityLabel?: string;
  /** The arrow of a row that opens a screen; off for "Sair". */
  readonly chevron?: boolean;
  readonly last?: boolean;
}

/** A row of 48 of screen 30 (Conta.dc.html `.r`). */
export function AccountRow({
  keyLabel,
  label,
  note,
  icon,
  valueIcon,
  onPress,
  accessibilityLabel,
  chevron = onPress !== undefined,
  last = false,
}: AccountRowProps) {
  const { colors, tokens } = useTheme();
  const content = (
    <>
      {icon}
      {keyLabel === undefined ? null : (
        <Text variant="muted" style={{ flexBasis: KEY_BASIS, flexShrink: 0 }}>
          {keyLabel}
        </Text>
      )}
      {valueIcon}
      <Text variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
        {label}
      </Text>
      {note === undefined ? null : (
        <Text variant="muted" style={{ fontSize: tokens.fontSizes.small }}>
          {note}
        </Text>
      )}
      {chevron ? <ChevronRightIcon /> : null}
    </>
  );
  const style = {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.s10,
    minHeight: tokens.sizes.settingRowMin,
    paddingHorizontal: tokens.spacing.s14,
    borderBottomWidth: last ? 0 : tokens.borderWidths.thin,
    borderBottomColor: colors.borderDivider,
  } as const;
  if (onPress === undefined) {
    return (
      <View style={style} accessible accessibilityLabel={accessibilityLabel}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={style}
    >
      {content}
    </Pressable>
  );
}
