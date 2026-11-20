import { View } from "react-native";
import { Path } from "react-native-svg";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { Button } from "../../../ui/Button";
import { StrokeIcon, type IconProps } from "../../../ui/Icons";
import { Text } from "../../../ui/Text";

const { share } = strings.summary;
const CHAT_ICON_STROKE = 2;
const CHAT_PATH = "M4 20l1.4-3.8A8 8 0 1 1 8.2 19z";

function ChatIcon({ color }: IconProps) {
  const { tokens } = useTheme();
  return (
    <StrokeIcon color={color} size={tokens.sizes.plusIcon} strokeWidth={CHAT_ICON_STROKE}>
      <Path d={CHAT_PATH} strokeLinejoin="round" />
    </StrokeIcon>
  );
}

export interface ShareBlockProps {
  readonly onShare: () => void;
}

/** "Mandar pro grupo · WhatsApp": opens the share sheet with the text of the summary (E4.12). */
export function ShareBlock({ onShare }: ShareBlockProps) {
  const { tokens } = useTheme();
  return (
    <View style={{ gap: tokens.spacing.s }}>
      <Text variant="bodyStrong" accessibilityRole="header">
        {share.title}
      </Text>
      <Button
        label={share.whatsapp}
        variant="secondary"
        onPress={onShare}
        renderIcon={(color) => <ChatIcon color={color} />}
      />
    </View>
  );
}
