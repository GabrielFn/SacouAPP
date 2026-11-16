import type { ReactNode } from "react";
import { View } from "react-native";

import { useTheme } from "../../../theme/theme-context";
import { Text } from "../../../ui/Text";

export interface ProfileSectionProps {
  readonly title: string;
  /** The small grey words after the title ("pode marcar mais de uma"). */
  readonly note?: string;
  readonly children: ReactNode;
}

/** A block of the quick profile: the bold legend of the canvas (`.lg`) and its controls. */
export function ProfileSection({ title, note, children }: ProfileSectionProps) {
  const { tokens } = useTheme();
  return (
    <View style={{ gap: tokens.spacing.s }}>
      <Text variant="title" accessibilityRole="header">
        {title}
        {note === undefined ? null : (
          <Text variant="muted" style={{ fontSize: tokens.fontSizes.caption }}>
            {` ${note}`}
          </Text>
        )}
      </Text>
      {children}
    </View>
  );
}
