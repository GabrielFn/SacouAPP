import { useRouter } from "expo-router";
import { useState, type ReactNode } from "react";
import { View } from "react-native";

import type { AccountView } from "../../../services/auth/auth-session";
import { useServices } from "../../../services/services-context";
import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { BackBar } from "../../../ui/BackBar";
import { DocumentIcon, DownloadIcon, ShieldIcon, SignOutIcon } from "../../../ui/MenuIcons";
import { Screen } from "../../../ui/Screen";
import { Text } from "../../../ui/Text";
import { meHref } from "../../groups/navigation";
import { useMyProfile } from "../../profile/hooks/use-profile";
import { accountScreenView } from "../model/account-view";
import { accountRoutes, isAccountScreenReady } from "../navigation";
import { AccountCard, AccountRow } from "./AccountRow";
import { DeleteAccountCard } from "./DeleteAccountCard";
import { ExportDataSheet } from "./ExportDataSheet";

export interface AccountScreenProps {
  readonly account: AccountView;
}

/** The "G" in its circle, beside "Google" (Conta.dc.html, the login row). */
function GoogleMark() {
  const { colors, tokens } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: tokens.sizes.loginBadge,
        aspectRatio: 1,
        borderRadius: tokens.radii.pill,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.borderChip,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text variant="bodyStrong" style={{ fontSize: tokens.fontSizes.caption, color: colors.link }}>
        {strings.account.googleMark}
      </Text>
    </View>
  );
}

export interface LegalRowProps {
  /** `null` until E6.1 publishes the document: the row is not shown (question 62). */
  readonly url: string | null;
  readonly label: string;
  readonly icon: ReactNode;
}

/** "Termos de uso" and "Política de privacidade": opened outside the app, `https:` only. */
function LegalRow({ url, label, icon }: LegalRowProps) {
  const { externalLink } = useServices();
  if (url === null) return null;
  return (
    <AccountRow
      icon={icon}
      label={label}
      onPress={() => {
        void externalLink.open(url);
      }}
    />
  );
}

/** Screen 30, "Conta" (Conta.dc.html), with the export sheet (30a) and the way to the deletion (30b). */
export function AccountScreen({ account }: AccountScreenProps) {
  const router = useRouter();
  // Simple state of one field (frontend.md, rule 4): the sheet is mounted only while open.
  const [exporting, setExporting] = useState(false);
  const { legalLinks, sessionEnder } = useServices();
  const profile = useMyProfile();
  const view = accountScreenView({ account, profile: profile.data, legalLinks });
  const texts = strings.account;
  return (
    <Screen scroll>
      <BackBar title={texts.title} fallbackHref={meHref} look="heading" />
      <AccountCard title={texts.yourData}>
        <AccountRow
          keyLabel={texts.nickname}
          label={view.nickname}
          accessibilityLabel={view.nicknameA11y}
          onPress={() => {
            router.push(accountRoutes.editProfile);
          }}
        />
        {view.email === null ? null : <AccountRow keyLabel={texts.email} label={view.email} />}
        <AccountRow
          keyLabel={texts.login}
          label={view.provider}
          valueIcon={view.showsGoogleMark ? <GoogleMark /> : undefined}
          last
        />
      </AccountCard>
      <AccountCard title={texts.notificationsTitle}>
        <AccountRow
          label={texts.notifications}
          note={texts.notificationsNote}
          onPress={() => {
            router.push(accountRoutes.notifications);
          }}
          last
        />
      </AccountCard>
      <AccountCard title={texts.more}>
        {isAccountScreenReady("export") ? (
          <AccountRow
            icon={<DownloadIcon />}
            label={texts.exportRow}
            onPress={() => {
              setExporting(true);
            }}
          />
        ) : null}
        <LegalRow url={view.termsUrl} label={texts.terms} icon={<DocumentIcon />} />
        <LegalRow url={view.privacyUrl} label={texts.privacy} icon={<ShieldIcon />} />
        <AccountRow
          icon={<SignOutIcon />}
          label={texts.signOut}
          chevron={false}
          onPress={() => {
            void sessionEnder.end("signedOut");
          }}
          last
        />
      </AccountCard>
      {isAccountScreenReady("delete") ? (
        <DeleteAccountCard
          onDelete={() => {
            router.push(accountRoutes.deleteAccount);
          }}
        />
      ) : null}
      {exporting ? (
        <ExportDataSheet
          onClose={() => {
            setExporting(false);
          }}
        />
      ) : null}
    </Screen>
  );
}
