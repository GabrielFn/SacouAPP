import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { strings } from "../strings/pt-BR";
import { useTheme } from "../theme/theme-context";
import { createBackdropDismiss } from "./backdrop-dismiss";
import { CloseIcon } from "./Icons";
import { useKeyboardVisibility } from "./keyboard-visibility";
import { Text } from "./Text";

export interface BottomSheetProps {
  readonly visible: boolean;
  readonly title: string;
  /** Back button, tap outside (not while the keyboard is up, or just closed) and the dismiss of the screen reader. */
  readonly onClose: () => void;
  readonly children: ReactNode;
  /** A cross beside the title that closes the sheet, with this label ("Fechar" of PreJogo.dc.html). */
  readonly closeLabel?: string;
}

export interface SheetTitleProps {
  readonly title: string;
  readonly closeLabel: string | undefined;
  readonly onClose: () => void;
}

function SheetTitle({ title, closeLabel, onClose }: SheetTitleProps) {
  const { tokens } = useTheme();
  const heading = (
    <Text variant="display" displaySize="displayBlock" accessibilityRole="header">
      {title}
    </Text>
  );
  if (closeLabel === undefined) return heading;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s }}>
      <View style={{ flex: 1 }}>{heading}</View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={closeLabel}
        onPress={onClose}
        style={{
          minWidth: tokens.sizes.iconButton,
          minHeight: tokens.sizes.iconButton,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CloseIcon />
      </Pressable>
    </View>
  );
}

const SHEET_MAX_HEIGHT = "85%";
/** Bottom padding lifts the sheet above the keyboard (the Android dialog is not resized edge-to-edge). */
const KEYBOARD_BEHAVIOR = "padding";

/** A sheet over the screen, on the `Modal` of React Native. It holds no state of its own. */
export function BottomSheet({ visible, title, onClose, children, closeLabel }: BottomSheetProps) {
  const { colors, tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardVisibility();
  const latestOnClose = useRef(onClose);
  latestOnClose.current = onClose;
  const backdrop = useMemo(
    () =>
      createBackdropDismiss(
        keyboard,
        () => {
          latestOnClose.current();
        },
        Date.now,
      ),
    [keyboard],
  );
  useEffect(() => backdrop.release, [backdrop]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={KEYBOARD_BEHAVIOR}
        style={{ flex: 1, justifyContent: "flex-end" }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={strings.settings.sheets.dismiss}
          onPress={backdrop.onBackdropPress}
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
            <SheetTitle title={title} closeLabel={closeLabel} onClose={onClose} />
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
