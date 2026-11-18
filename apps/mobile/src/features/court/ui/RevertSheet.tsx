import { View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { fontFamilies } from "../../../theme/tokens.data";
import { Button } from "../../../ui/Button";
import { Text } from "../../../ui/Text";
import type { RevertSheetModel } from "../corrections/corrections-selectors";

export interface RevertSheetProps {
  readonly model: RevertSheetModel;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

interface FactProps {
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
  const { colors, tokens } = useTheme();
  return (
    <View
      accessibilityViewIsModal
      style={{
        backgroundColor: colors.surface,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.borderCard,
        borderRadius: tokens.radii.tile,
        padding: tokens.spacing.l,
        gap: tokens.spacing.s,
      }}
    >
      <Text variant="display" displaySize="displayBlock" accessibilityRole="header">
        {model.title}
      </Text>
      <Fact label={corrections.revertScore}>{`${model.currentScore} → ${model.revertedScore}`}</Fact>
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
      <Button label={corrections.revertConfirm} onPress={onConfirm} />
      <Button label={corrections.revertCancel} variant="outline" onPress={onCancel} />
    </View>
  );
}
