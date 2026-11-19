import { useRouter } from "expo-router";

import type { AccountView } from "../../../services/auth/auth-session";
import { strings } from "../../../strings/pt-BR";
import { BackBar } from "../../../ui/BackBar";
import { EmptyState } from "../../../ui/EmptyState";
import { LoadingState } from "../../../ui/LoadingState";
import { Screen } from "../../../ui/Screen";
import { accountRoutes } from "../../account/navigation";
import { useMyProfile } from "../hooks/use-profile";
import { editProfileView, isProfileStub, loadFailureText } from "../model/profile-stub";
import { initFromAccount, initFromProfile } from "../model/profile-form.reducer";
import { QuickProfileScreen } from "./QuickProfileScreen";

export interface EditProfileScreenProps {
  readonly account: AccountView;
}

/**
 * Screen 27 opened from the account (question 60). The form is mounted only once the query has its
 * answer, which becomes the initial state of the reducer: no effect copies it (frontend.md, rule 1).
 */
export function EditProfileScreen({ account }: EditProfileScreenProps) {
  const router = useRouter();
  const profile = useMyProfile();
  const { profile: texts } = strings;
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(accountRoutes.account);
  };
  const view = editProfileView(profile);
  if (view === "loading") {
    return (
      <Screen>
        <LoadingState accessibilityLabel={texts.loading} />
      </Screen>
    );
  }
  if (view === "error" || profile.data === undefined) {
    return (
      <Screen>
        <BackBar title={texts.title} fallbackHref={accountRoutes.account} />
        <EmptyState
          alert
          title={texts.loadFailed}
          body={loadFailureText(profile)}
          actions={[
            {
              label: texts.retry,
              onPress: () => {
                void profile.refetch();
              },
            },
          ]}
        />
      </Screen>
    );
  }
  const initial =
    profile.data === null || isProfileStub(profile.data)
      ? initFromAccount(account.displayName)
      : initFromProfile(profile.data);
  return <QuickProfileScreen mode="edit" initial={initial} onSaved={goBack} />;
}
