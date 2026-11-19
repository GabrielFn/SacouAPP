import { Pressable, View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { fontFamilies } from "../../../theme/tokens.data";
import { Text } from "../../../ui/Text";
import { SheetPanel } from "./SheetPanel";
import type { RevertSheetModel } from "../corrections/corrections-selectors";

export interface RevertSheetProps {
  readonly model: RevertSheetModel;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/** Cancel and confirm share the line 1 to 1.55 (Corrigir.dc.html). */
const REVERT_CONFIRM_FLEX = 1.55;

interface RevertButtonProps {
  readonly label: string;
  readonly primary: boolean;
  readonly onPress: () => void;
}

function RevertButton({ label, primary, onPress }: RevertButtonProps) {
  const { colors, tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        height: tokens.sizes.revertButton,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: tokens.radii.button,
        borderWidth: primary ? 0 : tokens.borderWidths.thin,
        borderColor: colors.text,
        backgroundColor: primary ? colors.primary : "transparent",
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          color: primary ? colors.onPrimary : colors.text,
          fontFamily: fontFamilies.body700,
          fontSize: tokens.fontSizes.field,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export interface FactProps {
  readonly label: string;
  readonly children: string;
}

function Fact({ label, children }: FactProps) {
  const { tokens } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s }}>
      <Text variant="muted" style={{ flexBasis: "22%", fontFamily: fontFamilies.body600 }}>
        {label}
      </Text>
      <Text style={{ flex: 1 }}>{children}</Text>
    </View>
  );
}

/** What "Voltar o jogo para 16x14?" changes, before it is done. Nothing is erased from the log. */
export function RevertSheet({ model, onConfirm, onCancel }: RevertSheetProps) {
  const { corrections } = strings.court;
  const { tokens } = useTheme();
  return (
    <SheetPanel>
      <Text
        variant="display"
        accessibilityRole="header"
        style={{ fontSize: tokens.fontSizes.revertTitle, lineHeight: tokens.fontSizes.revertTitle }}
      >
        {model.title}
      </Text>
      <Fact label={corrections.revertScore}>
        {corrections.scoreChange(model.currentScore, model.revertedScore)}
      </Fact>
      {model.serveText === null ? null : (
        <Fact label={corrections.revertServe}>{model.serveText}</Fact>
      )}
      {model.rotationTexts.map((text) => (
        <Fact key={text} label={corrections.revertRotation}>
          {text}
        </Fact>
      ))}
      <Text variant="muted">{model.removedPointsText}</Text>
      {model.removedAlsoText === null ? null : <Text variant="muted">{model.removedAlsoText}</Text>}
      <View style={{ flexDirection: "row", gap: tokens.spacing.s, marginTop: tokens.spacing.xs }}>
        <View style={{ flex: 1 }}>
          <RevertButton label={corrections.revertCancel} primary={false} onPress={onCancel} />
        </View>
        <View style={{ flex: REVERT_CONFIRM_FLEX }}>
          <RevertButton label={corrections.revertConfirm} primary onPress={onConfirm} />
        </View>
      </View>
    </SheetPanel>
  );
}
