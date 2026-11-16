import { Pressable, View } from "react-native";

import type { LegalLinks } from "../../../config/legal-links";
import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { fontFamilies } from "../../../theme/tokens.data";
import { Text } from "../../../ui/Text";

export interface LegalLineProps {
  readonly links: LegalLinks;
  readonly onOpen: (url: string) => void;
}

export interface LegalWordProps {
  readonly label: string;
  readonly url: string | null;
  readonly onOpen: (url: string) => void;
}

/** A word of the sentence that opens its document; plain text until E6.1 publishes it (question 62). */
function LegalWord({ label, url, onOpen }: LegalWordProps) {
  const { colors, tokens } = useTheme();
  const look = { fontSize: tokens.fontSizes.legal, color: colors.text };
  if (url === null) return <Text style={look}>{label}</Text>;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => {
        onOpen(url);
      }}
      style={{ minHeight: tokens.sizes.minTouchTarget, justifyContent: "center" }}
    >
      <Text style={{ ...look, fontFamily: fontFamilies.body600, textDecorationLine: "underline" }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** "Ao entrar você aceita os Termos e a Política de Privacidade.", each document a 44 target. */
export function LegalLine({ links, onOpen }: LegalLineProps) {
  const { tokens } = useTheme();
  const { legal } = strings.auth;
  const plain = { fontSize: tokens.fontSizes.legal };
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text variant="muted" style={plain}>
        {legal.before}
      </Text>
      <LegalWord label={legal.terms} url={links.terms} onOpen={onOpen} />
      <Text variant="muted" style={plain}>
        {legal.between}
      </Text>
      <LegalWord label={legal.privacy} url={links.privacy} onOpen={onOpen} />
      <Text variant="muted" style={plain}>
        {legal.after}
      </Text>
    </View>
  );
}
