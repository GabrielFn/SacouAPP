import { AccountScreen } from "../../features/account/ui/AccountScreen";
import { useSession } from "../../services/auth/use-session";

/** Screen 30: the e-mail and the login come from the phone, never from the API. */
export default function AccountRoute() {
  const session = useSession();
  return session.status === "signedIn" ? <AccountScreen account={session.account} /> : null;
}
