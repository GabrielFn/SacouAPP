import { Pressable, View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { fontFamilies } from "../../../theme/tokens.data";
import { BackBar } from "../../../ui/BackBar";
import { Button } from "../../../ui/Button";
import { ConfirmSheet } from "../../../ui/ConfirmSheet";
import { EmptyState } from "../../../ui/EmptyState";
import { LinkIcon } from "../../../ui/Icons";
import { LoadingState } from "../../../ui/LoadingState";
import { QrCode } from "../../../ui/QrCode";
import { Screen } from "../../../ui/Screen";
import { Text } from "../../../ui/Text";
import { useInviteScreen, type InviteScreenModel, type ReadyInvite } from "../hooks/use-invite-screen";
import { groupMembersHref } from "../navigation";
import { useGroup } from "../queries/use-group-queries";

const texts = strings.invite;

export interface LinkCardProps {
  readonly shown: string;
  readonly copied: boolean;
  readonly onCopy: () => void;
}

/** The shortened link and "Copiar": the only way the token reaches the clipboard (ADR 0049, D7). */
function LinkCard({ shown, copied, onCopy }: LinkCardProps) {
  const { colors, tokens } = useTheme();
  return (
    <View style={{ gap: tokens.spacing.xs }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: tokens.spacing.s10,
          minHeight: tokens.sizes.settingRowMin,
          paddingHorizontal: tokens.spacing.m,
          backgroundColor: colors.surface,
          borderRadius: tokens.radii.tile,
          borderWidth: tokens.borderWidths.thin,
          borderColor: colors.borderCard,
        }}
      >
        <Text accessibilityLabel={texts.linkLabel(shown)} numberOfLines={1} style={{ flex: 1 }}>
          {shown}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={texts.copyLabel}
          onPress={onCopy}
          style={{
            minHeight: tokens.sizes.minTouchTarget,
            paddingHorizontal: tokens.spacing.m,
            justifyContent: "center",
            borderRadius: tokens.radii.field,
            borderWidth: tokens.borderWidths.thin,
            borderColor: colors.text,
          }}
        >
          <Text style={{ fontFamily: fontFamilies.body700 }}>{texts.copy}</Text>
        </Pressable>
      </View>
      {copied ? (
        <Text variant="muted" accessibilityLiveRegion="polite">
          {texts.copied}
        </Text>
      ) : null}
    </View>
  );
}

export interface ReadyInviteViewProps {
  readonly invite: ReadyInvite;
  readonly groupName: string;
  readonly model: InviteScreenModel;
}

function ReadyInviteView({ invite, groupName, model }: ReadyInviteViewProps) {
  return (
    <>
      <QrCode matrix={invite.matrix} accessibilityLabel={texts.qrLabel(groupName)} />
      <Text variant="muted" style={{ textAlign: "center" }}>
        {texts.showOnCourt}
      </Text>
      <LinkCard shown={invite.shown} copied={model.state.copied} onCopy={model.copy} />
      <Button
        label={texts.whatsapp}
        disabled={model.pending}
        onPress={model.sendOnWhatsApp}
        renderIcon={(color) => <LinkIcon color={color} />}
      />
      <Button
        label={texts.regenerate}
        variant="dangerText"
        disabled={model.pending}
        onPress={model.askRegenerate}
      />
      <Text variant="muted" style={{ textAlign: "center" }}>
        {texts.validity}
      </Text>
    </>
  );
}

export interface InviteBodyProps {
  readonly groupName: string;
  readonly model: InviteScreenModel;
}

function InviteBody({ groupName, model }: InviteBodyProps) {
  const { view } = model;
  switch (view.kind) {
    case "unavailable":
      return <EmptyState title={texts.unavailableTitle} body={texts.unavailableBody} actions={[]} />;
    case "loading":
      return <LoadingState accessibilityLabel={texts.loading} />;
    case "failed":
      return (
        <EmptyState
          alert
          title={texts.loadError}
          body={view.errorText}
          actions={[{ label: texts.retry, variant: "secondary", onPress: model.retry }]}
        />
      );
    case "ready":
      return <ReadyInviteView invite={view.invite} groupName={groupName} model={model} />;
  }
}

export interface InviteScreenProps {
  readonly groupId: string;
}

/** Screen 19d, a whole screen: the QR, the link, WhatsApp and "Desativar e gerar outro" (D7). */
export function InviteScreen({ groupId }: InviteScreenProps) {
  const { tokens } = useTheme();
  const group = useGroup(groupId);
  const groupName = group.data?.name ?? "";
  const model = useInviteScreen(groupId, groupName);
  return (
    <Screen scroll>
      <BackBar title={texts.header(groupName)} fallbackHref={groupMembersHref(groupId)} />
      <View style={{ gap: tokens.spacing.m }}>
        <Text variant="display" displaySize="displayTitleSmall" accessibilityRole="header">
          {texts.title}
        </Text>
        <Text variant="muted">{texts.intro}</Text>
      </View>
      <InviteBody groupName={groupName} model={model} />
      <ConfirmSheet
        visible={model.state.confirmingRegenerate}
        title={texts.regenerateConfirmTitle}
        body={texts.regenerateConfirmBody}
        confirmLabel={texts.regenerateConfirm}
        cancelLabel={texts.cancel}
        onConfirm={model.regenerate}
        onCancel={model.closeRegenerate}
      />
    </Screen>
  );
}
