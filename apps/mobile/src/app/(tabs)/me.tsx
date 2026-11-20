import { useRouter } from "expo-router";

import { accountRoutes } from "../../features/account/navigation";
import { meRoutes } from "../../features/profile/navigation";
import { ProfileScreen } from "../../features/profile/ui/ProfileScreen";
import { useSession } from "../../services/auth/use-session";

/** The "Eu" tab (screen 14, E4.13). The gear opens the account (screen 30). */
export default function MeScreen() {
  const router = useRouter();
  const session = useSession();
  return (
    <ProfileScreen
      accountName={session.status === "signedIn" ? session.account.displayName : null}
      onOpenAccount={() => {
        router.push(accountRoutes.account);
      }}
      onShare={() => {
        router.push(meRoutes.card);
      }}
      onEditProfile={() => {
        router.push(accountRoutes.editProfile);
      }}
    />
  );
}
