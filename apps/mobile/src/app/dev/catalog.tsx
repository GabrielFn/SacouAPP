import { Redirect } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";

import { DEV_TOOLS_ENABLED } from "../../config/dev-tools";
import { strings } from "../../strings/pt-BR";
import { ThemeProvider, useTheme } from "../../theme/theme-context";
import type { ThemeName } from "../../theme/themes";
import { palette } from "../../theme/tokens.data";
import { AppHeader } from "../../ui/AppHeader";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { Chip } from "../../ui/Chip";
import { IconButton } from "../../ui/IconButton";
import { PlusIcon } from "../../ui/Icons";
import { StatusPill } from "../../ui/StatusPill";
import { Text } from "../../ui/Text";
import { TextField } from "../../ui/TextField";

const SHOWN_THEMES: readonly { readonly name: ThemeName; readonly title: string }[] = [
  { name: "app", title: strings.catalog.themeApp },
  { name: "courtSun", title: strings.catalog.themeCourtSun },
  { name: "courtNight", title: strings.catalog.themeCourtNight },
];

function noop() {
  return undefined;
}

export interface ThemeSectionProps {
  readonly title: string;
}

function ThemeSection({ title }: ThemeSectionProps) {
  const { colors, tokens } = useTheme();
  const [text, setText] = useState("");
  const [radio, setRadio] = useState(true);
  const [toggle, setToggle] = useState(false);
  return (
    <View
      style={{
        backgroundColor: colors.background,
        padding: tokens.spacing.xl,
        gap: tokens.spacing.m,
      }}
    >
      <Text variant="title">{title}</Text>
      <AppHeader
        action={
          <IconButton accessibilityLabel={strings.a11y.createGroup} onPress={noop}>
            <PlusIcon />
          </IconButton>
        }
      />
      <Button label={strings.catalog.buttonPrimary} onPress={noop} />
      <Button label={strings.catalog.buttonSecondary} variant="secondary" onPress={noop} />
      <Button label={strings.catalog.buttonLink} variant="link" onPress={noop} />
      <View style={{ flexDirection: "row", gap: tokens.spacing.s }}>
        <Chip
          label={strings.catalog.chipRadio}
          selected={radio}
          onPress={() => {
            setRadio(!radio);
          }}
        />
        <Chip
          kind="toggle"
          label={strings.catalog.chipToggle}
          selected={toggle}
          onPress={() => {
            setToggle(!toggle);
          }}
        />
      </View>
      <View style={{ flexDirection: "row", gap: tokens.spacing.s }}>
        <StatusPill status="confirmed" label={strings.catalog.statusConfirmed} />
        <StatusPill status="waiting" label={strings.catalog.statusWaiting} />
        <StatusPill status="pay" label={strings.catalog.statusPay} />
      </View>
      <Card stripColor={palette.serveOrange}>
        <Text variant="title">{strings.catalog.cardTitle}</Text>
        <Text variant="muted">{strings.catalog.cardBody}</Text>
      </Card>
      <TextField
        label={strings.catalog.fieldLabel}
        help={strings.catalog.fieldHelp}
        placeholder={strings.catalog.fieldPlaceholder}
        value={text}
        onChangeText={setText}
      />
    </View>
  );
}

export default function CatalogScreen() {
  if (!DEV_TOOLS_ENABLED) return <Redirect href="/" />;
  return (
    <ScrollView>
      {SHOWN_THEMES.map(({ name, title }) => (
        <ThemeProvider key={name} name={name}>
          <ThemeSection title={title} />
        </ThemeProvider>
      ))}
    </ScrollView>
  );
}
