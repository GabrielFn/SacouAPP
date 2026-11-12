import { useRouter } from "expo-router";
import { useReducer } from "react";
import { View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { Button } from "../../../ui/Button";
import { Screen } from "../../../ui/Screen";
import { StepHeader } from "../../../ui/StepHeader";
import { Text } from "../../../ui/Text";
import { customBlocksReducer, initialCustomBlocksState } from "../model/custom-blocks.reducer";
import { CUSTOM_BLOCKS, scratchOrigin } from "../model/custom-blocks";
import { createGroupDetailsHref, createGroupHref } from "../navigation";
import { CustomBlockCard } from "./CustomBlockCard";

const { custom } = strings.createGroup;

/** Screen 04a: "Monte do seu jeito". The blocks are only chosen here; the fine tuning is in screen 18. */
export function CreateGroupCustomScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const [state, dispatch] = useReducer(customBlocksReducer, initialCustomBlocksState);
  return (
    <Screen
      footer={
        <Button
          label={custom.continue}
          onPress={() => {
            router.push(createGroupDetailsHref(scratchOrigin(state.enabled)));
          }}
        />
      }
    >
      <StepHeader
        title={strings.createGroup.step1.stepLabel}
        onBack={() => {
          if (router.canGoBack()) router.back();
          else router.replace(createGroupHref);
        }}
      />
      <View style={{ gap: tokens.spacing.xs }}>
        <Text variant="display" displaySize="displayTitleSmall" accessibilityRole="header">
          {custom.title}
        </Text>
        <Text variant="muted">{custom.subtitle}</Text>
      </View>
      <View style={{ gap: tokens.spacing.s }}>
        {CUSTOM_BLOCKS.map((block) => (
          <CustomBlockCard
            key={block}
            block={block}
            enabled={state.enabled.includes(block)}
            expanded={state.expanded === block}
            onToggleEnabled={(value) => {
              dispatch({ type: "block-toggled", block: value });
            }}
            onToggleExpanded={(value) => {
              dispatch({ type: "block-expanded", block: value });
            }}
          />
        ))}
      </View>
    </Screen>
  );
}
