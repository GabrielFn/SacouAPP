import { getSettingsTemplate, type SettingsTemplateKey } from "@sacou/match-engine";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { Button } from "../../../ui/Button";
import { Screen } from "../../../ui/Screen";
import { StepHeader } from "../../../ui/StepHeader";
import { Text } from "../../../ui/Text";
import { READY_TEMPLATES, templateOrigin } from "../model/custom-blocks";
import { createGroupCustomHref, createGroupDetailsHref, groupsHref } from "../navigation";
import { FromScratchLink } from "./FromScratchLink";
import { TemplateOption } from "./TemplateOption";

const { step1 } = strings.createGroup;
const FIRST_STEP_PROGRESS = 0.5;
/** The option that is marked when the screen opens, as in the canvas. */
const INITIAL_TEMPLATE: SettingsTemplateKey = "racha-organizado";

/** Screen 04: the template of the new group. The choice is the only state here, a single field. */
export function CreateGroupTemplateScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const [selected, setSelected] = useState<SettingsTemplateKey>(INITIAL_TEMPLATE);
  return (
    <Screen
      footer={
        <Button
          label={step1.continueWith(strings.settings.templates[selected].name)}
          onPress={() => {
            router.push(createGroupDetailsHref(templateOrigin(selected)));
          }}
        />
      }
    >
      <StepHeader
        title={step1.stepLabel}
        progressLabel={step1.progress}
        progress={FIRST_STEP_PROGRESS}
        onBack={() => {
          if (router.canGoBack()) router.back();
          else router.replace(groupsHref);
        }}
      />
      <View style={{ gap: tokens.spacing.xs }}>
        <Text variant="display" displaySize="displayTitleSmall" accessibilityRole="header">
          {step1.title}
        </Text>
        <Text variant="muted">{step1.subtitle}</Text>
      </View>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={step1.radiogroup}
        style={{ gap: tokens.spacing.s10 }}
      >
        {READY_TEMPLATES.map((key) => (
          <TemplateOption
            key={key}
            templateKey={key}
            pro={getSettingsTemplate(key).pro}
            selected={key === selected}
            onSelect={setSelected}
          />
        ))}
      </View>
      <FromScratchLink
        onPress={() => {
          router.push(createGroupCustomHref);
        }}
      />
    </Screen>
  );
}
