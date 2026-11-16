import { Pressable, View } from "react-native";

import type { LegalLinks } from "../../../config/legal-links";
import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { fontFamilies } from "../../../theme/tokens.data";
import { Text } from "../../../ui/Text";
import { wordsOf } from "../model/legal-words";

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

export interface PlainWordsProps {
  readonly text: string;
}

/** A plain part of the sentence, a piece per word, so the line breaks between words. */
function PlainWords({ text }: PlainWordsProps) {
  const { tokens } = useTheme();
  const plain = { fontSize: tokens.fontSizes.legal };
  return wordsOf(text).map((word, index) => (
    <Text key={`${String(index)}-${word}`} variant="muted" style={plain}>
      {word}
    </Text>
  ));
}

/** "Ao entrar você aceita os Termos e a Política de Privacidade.", each document a 44 target. */
export function LegalLine({ links, onOpen }: LegalLineProps) {
  const { legal } = strings.auth;
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <PlainWords text={legal.before} />
      <LegalWord label={legal.terms} url={links.terms} onOpen={onOpen} />
      <PlainWords text={legal.between} />
      <LegalWord label={legal.privacy} url={links.privacy} onOpen={onOpen} />
      <PlainWords text={legal.after} />
    </View>
  );
}
