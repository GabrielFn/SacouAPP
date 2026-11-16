import { useRouter } from "expo-router";
import { View } from "react-native";

import type { AuthProvider } from "../../../services/auth/auth-session";
import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { BackBar } from "../../../ui/BackBar";
import { Button } from "../../../ui/Button";
import { WarningIcon } from "../../../ui/Icons";
import { Screen } from "../../../ui/Screen";
import { Text } from "../../../ui/Text";
import { TextField } from "../../../ui/TextField";
import { groupMembersHref } from "../../groups/navigation";
import { useDeleteAccount } from "../hooks/use-delete-account";
import { blockerSentence, type BlockerNotice } from "../model/delete-account.selectors";
import { accountRoutes } from "../navigation";
import { LinesCard } from "./LinesCard";

export interface DeleteAccountScreenProps {
  readonly provider: AuthProvider;
}

const texts = strings.account.deleteScreen;

export interface BlockerNoticeViewProps {
  readonly notice: BlockerNotice;
}

/** The yellow notice: "Você é o único admin do **Racha de terça**…", read as one sentence. */
function BlockerNoticeView({ notice }: BlockerNoticeViewProps) {
  const { colors, tokens } = useTheme();
  const more = notice.others > 0 ? texts.blockerMore(notice.others) : "";
  return (
    <View
      accessible
      accessibilityLabel={blockerSentence(notice)}
      style={{
        flexDirection: "row",
        gap: tokens.spacing.s10,
        padding: tokens.spacing.m,
        borderRadius: tokens.radii.button,
        backgroundColor: colors.noticeFill,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.suggestBorder,
      }}
    >
      <WarningIcon color={colors.text} />
      <Text variant="body" style={{ flex: 1, fontSize: tokens.fontSizes.small }}>
        {texts.blockerStart}
        {notice.groupName === null ? (
          texts.blockerUnnamed
        ) : (
          <>
            {texts.blockerOfNamed}
            <Text variant="bodyStrong" style={{ fontSize: tokens.fontSizes.small }}>
              {notice.groupName}
            </Text>
          </>
        )}
        {more}
        {texts.blockerEnd}
      </Text>
    </View>
  );
}

/**
 * Screen 30b, "Excluir minha conta". The red button waits for the word and for a preview without
 * blockers; the API judges again on the `DELETE` (ADR 0056, D7). On 204 the session ends as `deleted`
 * and the gate shows screen 02 with "Sua conta foi excluída.".
 */
export function DeleteAccountScreen({ provider }: DeleteAccountScreenProps) {
  const router = useRouter();
  const { tokens } = useTheme();
  const model = useDeleteAccount(provider);
  const { notice } = model;
  return (
    <Screen scroll>
      <BackBar title={texts.back} fallbackHref={accountRoutes.account} />
      <View style={{ gap: tokens.spacing.s14 }}>
        <Text variant="display" displaySize="displayTitleSmall" accessibilityRole="header">
          {texts.title}
        </Text>
        <LinesCard lines={texts.consequences} />
        {notice === null ? null : (
          <>
            <BlockerNoticeView notice={notice} />
            <Button
              label={texts.chooseAdmin}
              variant="outline"
              onPress={() => {
                router.push(groupMembersHref(notice.firstGroupId));
              }}
            />
          </>
        )}
        {model.blockersError === null ? null : (
          <>
            <Text variant="caption" accessibilityRole="alert">
              {model.blockersError}
            </Text>
            <Button label={texts.retryBlockers} variant="link" onPress={model.retryBlockers} />
          </>
        )}
        <TextField
          label={texts.confirmLabel}
          placeholder={texts.confirmWord}
          value={model.state.confirmText}
          onChangeText={model.changeConfirm}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
        />
        {model.asksForPassword ? (
          <TextField
            label={texts.passwordLabel}
            value={model.state.password}
            onChangeText={model.changePassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password"
            textContentType="password"
          />
        ) : null}
        {model.message === null ? null : (
          <Text variant="caption" accessibilityRole="alert">
            {model.message}
          </Text>
        )}
        <Button
          label={
            model.pending
              ? texts.submitting
              : model.asksForPassword
                ? texts.passwordSubmit
                : texts.submit
          }
          variant="danger"
          disabled={!model.canDelete}
          onPress={model.submit}
        />
      </View>
    </Screen>
  );
}
