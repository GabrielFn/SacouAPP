import type { ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { strings } from "../strings/pt-BR";
import { useTheme } from "../theme/theme-context";
import { Text } from "./Text";

export interface BottomSheetProps {
  readonly visible: boolean;
  readonly title: string;
  /** Back button, tap outside and the dismiss of the screen reader. */
  readonly onClose: () => void;
  readonly children: ReactNode;
}

const SHEET_MAX_HEIGHT = "85%";
/** Bottom padding lifts the sheet above the keyboard (the Android dialog is not resized edge-to-edge). */
const KEYBOARD_BEHAVIOR = "padding";

/** A sheet over the screen, on the `Modal` of React Native. It holds no state of its own. */
export function BottomSheet({ visible, title, onClose, children }: BottomSheetProps) {
  const { colors, tokens } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={KEYBOARD_BEHAVIOR}
        style={{ flex: 1, justifyContent: "flex-end" }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={strings.settings.sheets.dismiss}
          onPress={onClose}
          style={{ flex: 1, backgroundColor: colors.badgeSurface }}
        />
        <View
          accessibilityViewIsModal
          style={{
            maxHeight: SHEET_MAX_HEIGHT,
            flexShrink: 1,
            backgroundColor: colors.background,
            borderTopLeftRadius: tokens.radii.card,
            borderTopRightRadius: tokens.radii.card,
            borderWidth: tokens.borderWidths.thin,
            borderColor: colors.borderCard,
          }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              padding: tokens.spacing.xl,
              paddingBottom: insets.bottom + tokens.spacing.xl,
              gap: tokens.spacing.l,
            }}
          >
            <Text variant="display" displaySize="displayBlock" accessibilityRole="header">
              {title}
            </Text>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
